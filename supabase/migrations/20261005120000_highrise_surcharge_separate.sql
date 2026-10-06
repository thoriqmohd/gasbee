-- Separate the High-Rise delivery surcharge into its own column so it shows
-- as a distinct line in the checkout breakdown, order page and receipts.
-- delivery_fee now holds the DISTANCE-based fee only; the surcharge is set
-- server-side from app_settings ('highrise_delivery_surcharge').

-- (Self-sufficient: also ensures the haversine helper exists — same as
-- 20261004011500. Safe to run whether or not that file was applied first.)
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND((6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::numeric, 3);
$$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS highrise_surcharge numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.order_insert_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); ptype text; aid uuid; base numeric;
  mlat numeric; mlng numeric; alat numeric; alng numeric; dist numeric;
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN RETURN NEW; END IF;
  IF NEW.merchant_id = public.user_merchant_id(uid) THEN RETURN NEW; END IF;
  IF NEW.customer_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Cannot create an order for another user';
  END IF;
  BEGIN aid := NULLIF(NEW.address_snapshot->>'id','')::uuid; EXCEPTION WHEN others THEN aid := NULL; END;
  SELECT a.property_type INTO ptype FROM public.addresses a WHERE a.id = aid AND a.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery address not found'; END IF;
  IF ptype IS NULL THEN RAISE EXCEPTION 'Please select the property type (Landed or High-Rise) for this address'; END IF;
  NEW.address_snapshot := NEW.address_snapshot || jsonb_build_object('property_type', ptype);
  NEW.payment_status := 'pending';
  NEW.status := 'pending';
  NEW.rider_id := NULL; NEW.accepted_at := NULL; NEW.rejected_at := NULL; NEW.assigned_at := NULL;
  NEW.picked_up_at := NULL; NEW.delivered_at := NULL; NEW.cancelled_at := NULL;
  NEW.proof_of_delivery_url := NULL; NEW.failure_reason := NULL;
  NEW.service_fee := public.setting_numeric('service_fee', 5);
  NEW.processing_fee := public.setting_numeric('processing_fee', 0);

  -- Distance-based delivery fee (server-authoritative)
  base := public.setting_numeric('delivery_base_fee', 5);
  SELECT m.latitude, m.longitude INTO mlat, mlng FROM public.merchants m WHERE m.id = NEW.merchant_id;
  alat := NULLIF(NEW.address_snapshot->>'latitude','')::numeric;
  alng := NULLIF(NEW.address_snapshot->>'longitude','')::numeric;
  IF alat IS NOT NULL AND alng IS NOT NULL AND mlat IS NOT NULL AND mlng IS NOT NULL THEN
    dist := public.haversine_km(mlat, mlng, alat, alng);
    -- fee = base + max(0, distance - base_km) * per_km, capped at RM500
    NEW.delivery_fee := ROUND(LEAST(
      base + GREATEST(0, COALESCE(dist, 0) - public.setting_numeric('delivery_base_km', 5))
            * public.setting_numeric('delivery_per_km', 1),
      500), 2);
  ELSE
    -- No coordinates on either side — fall back to the (clamped) client fee.
    NEW.delivery_fee := LEAST(GREATEST(COALESCE(NEW.delivery_fee, 0), base), 500);
  END IF;

  -- High-Rise surcharge in its OWN column (rendered as a separate line)
  NEW.highrise_surcharge := ROUND(CASE WHEN ptype = 'highrise'
    THEN public.setting_numeric('highrise_delivery_surcharge', 3) ELSE 0 END, 2);

  NEW.discount := GREATEST(COALESCE(NEW.discount, 0), 0);
  NEW.gas_exchange_fee := 0;
  NEW.items_subtotal := 0;
  NEW.total_amount := 0;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.order_recalc_totals()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  o record; s numeric := 0; promo numeric := 0; credit numeric := 0; allowed numeric := 0;
  refill_qty integer := 0; gas_fee numeric := 0; v record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF o.payment_status <> 'pending' OR o.status <> 'pending' THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO s FROM public.order_items WHERE order_id = o.id;

  SELECT COALESCE(SUM(oi.quantity), 0) INTO refill_qty
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE oi.order_id = o.id
    AND (c.slug = 'lpg-refill' OR (oi.type = 'refill' AND COALESCE(c.slug,'') NOT IN ('accessories','industrial-gas')));

  IF refill_qty > 0 AND o.gas_exchange_type IS NULL AND auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid()) AND o.customer_id = auth.uid() THEN
    RAISE EXCEPTION 'Please select your gas cylinder type (Petronas or Non-Petronas)';
  END IF;
  IF o.gas_exchange_type = 'non_petronas' AND refill_qty > 0 THEN
    gas_fee := ROUND(public.setting_numeric('gas_exchange_fee', 3) * refill_qty, 2);
  END IF;

  IF o.promotion_code IS NOT NULL AND length(trim(o.promotion_code)) > 0 THEN
    SELECT * INTO v FROM public.validate_promotion(o.promotion_code) LIMIT 1;
    IF FOUND THEN
      promo := CASE
        WHEN v.type = 'percent' THEN LEAST(s * v.value / 100, COALESCE(v.max_discount, s))
        WHEN v.type = 'flat' THEN v.value
        ELSE COALESCE(o.delivery_fee, 0) END;
      IF v.min_order_amount IS NOT NULL AND s < v.min_order_amount THEN promo := 0; END IF;
    END IF;
  END IF;
  promo := GREATEST(COALESCE(promo, 0), 0);

  SELECT COALESCE(SUM(amount), 0) INTO credit FROM public.order_credits
  WHERE user_id = o.customer_id AND (status = 'active' OR used_order_id = o.id);

  allowed := LEAST(COALESCE(o.discount, 0), promo + credit);

  PERFORM set_config('app.order_recalc', '1', true);
  UPDATE public.orders
     SET items_subtotal = s,
         gas_exchange_fee = gas_fee,
         discount = ROUND(allowed, 2),
         total_amount = GREATEST(0, ROUND(s + COALESCE(o.delivery_fee,0) + COALESCE(o.highrise_surcharge,0) + COALESCE(o.service_fee,0) + COALESCE(o.processing_fee,0) + gas_fee - allowed, 2))
   WHERE id = o.id;
  PERFORM set_config('app.order_recalc', '0', true);
  RETURN NEW;
END $function$;

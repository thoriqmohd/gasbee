ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gas_exchange_type text NULL,
  ADD COLUMN IF NOT EXISTS gas_exchange_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_gas_exchange_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_gas_exchange_type_check
  CHECK (gas_exchange_type IS NULL OR gas_exchange_type IN ('petronas','non_petronas'));

INSERT INTO public.app_settings (key, value) VALUES ('gas_exchange_fee', '{"value": 3}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_fee_settings()
 RETURNS TABLE(key text, value jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.key, s.value FROM public.app_settings s
  WHERE s.key IN ('service_fee','delivery_base_fee','delivery_base_km','delivery_per_km','processing_fee',
    'gas_exchange_fee','dev_mode_enabled','dev_mode_title','dev_mode_message','dev_mode_button');
$function$;

CREATE OR REPLACE FUNCTION public.order_insert_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN RETURN NEW; END IF;
  IF NEW.merchant_id = public.user_merchant_id(uid) THEN RETURN NEW; END IF;
  IF NEW.customer_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Cannot create an order for another user';
  END IF;
  NEW.payment_status := 'pending';
  NEW.status := 'pending';
  NEW.rider_id := NULL; NEW.accepted_at := NULL; NEW.rejected_at := NULL; NEW.assigned_at := NULL;
  NEW.picked_up_at := NULL; NEW.delivered_at := NULL; NEW.cancelled_at := NULL;
  NEW.proof_of_delivery_url := NULL; NEW.failure_reason := NULL;
  NEW.service_fee := public.setting_numeric('service_fee', 0);
  NEW.processing_fee := public.setting_numeric('processing_fee', 0);
  NEW.delivery_fee := LEAST(GREATEST(COALESCE(NEW.delivery_fee, 0), public.setting_numeric('delivery_base_fee', 0)), 500);
  NEW.discount := GREATEST(COALESCE(NEW.discount, 0), 0);
  NEW.gas_exchange_fee := 0;
  NEW.items_subtotal := 0;
  NEW.total_amount := 0;
  RETURN NEW;
END $function$;

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
         total_amount = GREATEST(0, ROUND(s + COALESCE(o.delivery_fee,0) + COALESCE(o.service_fee,0) + COALESCE(o.processing_fee,0) + gas_fee - allowed, 2))
   WHERE id = o.id;
  PERFORM set_config('app.order_recalc', '0', true);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.orders_customer_update_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('app.order_recalc', true), '0') = '1' THEN RETURN NEW; END IF;
  IF OLD.merchant_id = public.user_merchant_id(uid) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.riders r WHERE r.id = OLD.rider_id AND r.user_id = uid) THEN RETURN NEW; END IF;
  IF uid = OLD.customer_id THEN
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.items_subtotal IS DISTINCT FROM OLD.items_subtotal
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.service_fee IS DISTINCT FROM OLD.service_fee
       OR NEW.processing_fee IS DISTINCT FROM OLD.processing_fee
       OR NEW.gas_exchange_type IS DISTINCT FROM OLD.gas_exchange_type
       OR NEW.gas_exchange_fee IS DISTINCT FROM OLD.gas_exchange_fee
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.rider_id IS DISTINCT FROM OLD.rider_id
       OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.promotion_code IS DISTINCT FROM OLD.promotion_code
       OR NEW.proof_of_delivery_url IS DISTINCT FROM OLD.proof_of_delivery_url
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
       OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.picked_up_at IS DISTINCT FROM OLD.picked_up_at THEN
      RAISE EXCEPTION 'Customers cannot modify protected order fields';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (NEW.status::text = 'cancelled' AND OLD.status::text IN ('pending','accepted')) THEN
      RAISE EXCEPTION 'Customers may only cancel a pending order';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
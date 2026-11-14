-- Independent delivery migration. Compare current order_insert_guard() against
-- the inspected production version before applying to avoid replacing newer rules.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.gasbee_delivery_distance_km(
  from_latitude numeric,
  from_longitude numeric,
  to_latitude numeric,
  to_longitude numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = ''
AS $function$
  SELECT (
    6371.0 * 2 * pg_catalog.asin(pg_catalog.sqrt(least(1.0, greatest(0.0,
      pg_catalog.power(pg_catalog.sin(pg_catalog.radians((to_latitude - from_latitude)::double precision) / 2), 2)
      + pg_catalog.cos(pg_catalog.radians(from_latitude::double precision))
      * pg_catalog.cos(pg_catalog.radians(to_latitude::double precision))
      * pg_catalog.power(pg_catalog.sin(pg_catalog.radians((to_longitude - from_longitude)::double precision) / 2), 2)
    ))))
  )::numeric;
$function$;

REVOKE EXECUTE ON FUNCTION public.gasbee_delivery_distance_km(numeric,numeric,numeric,numeric)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.order_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  address_id uuid;
  saved_address public.addresses%ROWTYPE;
  saved_merchant public.merchants%ROWTYPE;
  distance_km numeric;
  radius_km numeric;
  base_fee numeric;
  base_km numeric;
  per_km numeric;
BEGIN
  -- Preserve the existing authenticated staff/server paths for assisted orders.
  IF uid IS NULL OR public.is_admin(uid) THEN RETURN NEW; END IF;
  IF NEW.merchant_id = public.user_merchant_id(uid) THEN RETURN NEW; END IF;
  IF NEW.customer_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Cannot create an order for another user' USING ERRCODE = '42501';
  END IF;

  BEGIN
    address_id := NULLIF(NEW.address_snapshot ->> 'id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    address_id := NULL;
  END;

  SELECT a.* INTO saved_address
  FROM public.addresses AS a
  WHERE a.id = address_id AND a.user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery address not found. Choose a saved address.'
      USING ERRCODE = '22023';
  END IF;
  IF saved_address.property_type IS NULL THEN
    RAISE EXCEPTION 'Please select the property type (Landed or High-Rise) for this address'
      USING ERRCODE = '22023';
  END IF;
  IF saved_address.latitude IS NULL OR saved_address.longitude IS NULL
     OR saved_address.latitude NOT BETWEEN -90 AND 90
     OR saved_address.longitude NOT BETWEEN -180 AND 180
     OR (saved_address.latitude = 0 AND saved_address.longitude = 0) THEN
    RAISE EXCEPTION 'Please update your saved delivery address with a valid map location.'
      USING ERRCODE = '22023';
  END IF;

  SELECT m.* INTO saved_merchant
  FROM public.merchants AS m
  WHERE m.id = NEW.merchant_id AND m.status = 'active';
  IF NOT FOUND OR saved_merchant.latitude IS NULL OR saved_merchant.longitude IS NULL
     OR saved_merchant.latitude NOT BETWEEN -90 AND 90
     OR saved_merchant.longitude NOT BETWEEN -180 AND 180
     OR (saved_merchant.latitude = 0 AND saved_merchant.longitude = 0) THEN
    RAISE EXCEPTION 'Delivery is not currently available from this merchant.'
      USING ERRCODE = '22023';
  END IF;

  radius_km := COALESCE(saved_merchant.delivery_radius_km, 10);
  IF radius_km <= 0 THEN
    RAISE EXCEPTION 'Delivery is not currently available from this merchant.'
      USING ERRCODE = '22023';
  END IF;

  distance_km := public.gasbee_delivery_distance_km(
    saved_merchant.latitude, saved_merchant.longitude,
    saved_address.latitude, saved_address.longitude
  );
  IF distance_km > radius_km THEN
    RAISE EXCEPTION 'Your saved address is outside this merchant''s delivery area (% km).', radius_km
      USING ERRCODE = '22023';
  END IF;

  -- Select only the address fields used by existing clients. Never persist the
  -- caller-supplied latitude, postal address, recipient or property type.
  NEW.address_snapshot := pg_catalog.jsonb_build_object(
    'id', saved_address.id,
    'label', saved_address.label,
    'recipient_name', saved_address.recipient_name,
    'recipient_phone', saved_address.recipient_phone,
    'address_line1', saved_address.address_line1,
    'address_line2', saved_address.address_line2,
    'city', saved_address.city,
    'state', saved_address.state,
    'postcode', saved_address.postcode,
    'latitude', saved_address.latitude,
    'longitude', saved_address.longitude,
    'property_type', saved_address.property_type,
    'floor', saved_address.floor,
    'unit_no', saved_address.unit_no
  );

  base_fee := greatest(public.setting_numeric('delivery_base_fee', 5), 0);
  base_km := greatest(public.setting_numeric('delivery_base_km', 5), 0);
  per_km := greatest(public.setting_numeric('delivery_per_km', 1), 0);
  NEW.delivery_fee := round(
    least(base_fee + greatest(distance_km - base_km, 0) * per_km, 500)
    + CASE WHEN saved_address.property_type = 'highrise'
      THEN public.setting_numeric('highrise_delivery_surcharge', 3) ELSE 0 END,
    2
  );
  NEW.service_fee := public.setting_numeric('service_fee', 5);
  NEW.processing_fee := public.setting_numeric('processing_fee', 0);
  NEW.payment_status := 'pending';
  NEW.status := 'pending';
  NEW.rider_id := NULL;
  NEW.accepted_at := NULL;
  NEW.rejected_at := NULL;
  NEW.assigned_at := NULL;
  NEW.picked_up_at := NULL;
  NEW.delivered_at := NULL;
  NEW.cancelled_at := NULL;
  NEW.proof_of_delivery_url := NULL;
  NEW.failure_reason := NULL;
  NEW.discount := greatest(COALESCE(NEW.discount, 0), 0);
  NEW.gas_exchange_fee := 0;
  NEW.items_subtotal := 0;
  NEW.total_amount := 0;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.protect_order_delivery_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR public.is_admin(actor)
     OR actor IS DISTINCT FROM OLD.customer_id
     OR OLD.merchant_id = public.user_merchant_id(actor) THEN RETURN NEW; END IF;
  IF NEW.address_snapshot IS DISTINCT FROM OLD.address_snapshot
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
    RAISE EXCEPTION 'Delivery address and fee are fixed after order creation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_order_delivery_quote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_order_delivery_quote ON public.orders;
CREATE TRIGGER trg_protect_order_delivery_quote
BEFORE UPDATE OF address_snapshot, delivery_fee, merchant_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_delivery_quote();

COMMIT;

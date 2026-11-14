-- Stage 1 of the coordinated CHIP replacement. Install only with the Edge Functions
-- patched to use these service-only RPCs. Existing CHIP and non-CHIP rows are retained.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.begin_chip_order_payment(
  p_order_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  locked_order public.orders%ROWTYPE;
  attempt public.payments%ROWTYPE;
BEGIN
  SELECT o.* INTO locked_order
  FROM public.orders AS o
  WHERE o.id = p_order_id AND o.customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order does not exist for this customer' USING ERRCODE = '42501';
  END IF;
  IF locked_order.payment_method NOT IN ('fpx', 'card', 'ewallet')
     OR locked_order.payment_method IS NULL
     OR locked_order.payment_status NOT IN ('pending', 'failed')
     OR locked_order.status <> 'pending'
     OR locked_order.total_amount IS NULL
     OR locked_order.total_amount <= 0
     OR NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = p_order_id) THEN
    RAISE EXCEPTION 'Order is not payable' USING ERRCODE = '22023';
  END IF;

  -- A verified finalizer must have marked the order paid in the same transaction.
  -- Fail closed for pre-migration rows where payment and order status differ.
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = p_order_id AND p.status IN ('paid','refunded','partial_refund')
  ) THEN
    RAISE EXCEPTION 'Order already has a completed payment' USING ERRCODE = '22023';
  END IF;

  -- Refuse overlapping payment providers while an external attempt remains active.
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = p_order_id AND p.gateway <> 'chip' AND p.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Order already has a pending payment' USING ERRCODE = '22023';
  END IF;

  -- Multiple historical links might all remain payable. Never offer another
  -- checkout link until those attempts have been reconciled.
  IF (
    SELECT count(*) FROM public.payments p
    WHERE p.order_id = p_order_id AND p.gateway = 'chip'
      AND NOT COALESCE(p.raw_payload ? '_gasbee_retired_status', false)
  ) > 1 THEN
    RETURN pg_catalog.jsonb_build_object('state', 'requires_review');
  END IF;

  -- Even legacy "failed" may represent a payable provider purchase. Ignore only
  -- attempts explicitly retired after an authoritative CHIP response.
  SELECT p.* INTO attempt
  FROM public.payments AS p
  WHERE p.order_id = p_order_id AND p.gateway = 'chip'
    AND NOT COALESCE(p.raw_payload ? '_gasbee_retired_status', false)
  ORDER BY
    (p.gateway_ref IS NULL) DESC, p.created_at DESC, p.id DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'state', CASE WHEN attempt.gateway_ref IS NULL THEN 'awaiting_gateway' ELSE 'check_gateway' END,
      'payment_id', attempt.id,
      'gateway_ref', attempt.gateway_ref,
      'amount', attempt.amount,
      'order_code', locked_order.code
    );
  END IF;

  INSERT INTO public.payments (order_id, gateway, amount, status, raw_payload)
  VALUES (
    p_order_id, 'chip', locked_order.total_amount, 'pending',
    pg_catalog.jsonb_build_object('_gasbee_reservation', true)
  )
  RETURNING * INTO attempt;

  RETURN pg_catalog.jsonb_build_object(
    'state', 'reserved',
    'payment_id', attempt.id,
    'amount', attempt.amount,
    'order_code', locked_order.code
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.finish_chip_order_payment(
  p_payment_id uuid,
  p_gateway_ref text,
  p_gateway_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  target_order_id uuid;
  attempt public.payments%ROWTYPE;
BEGIN
  IF NULLIF(p_gateway_ref, '') IS NULL
     OR pg_catalog.jsonb_typeof(p_gateway_payload) IS DISTINCT FROM 'object'
     OR (p_gateway_payload ->> 'id') IS DISTINCT FROM p_gateway_ref THEN
    RAISE EXCEPTION 'Invalid CHIP purchase reservation result' USING ERRCODE = '22023';
  END IF;

  SELECT p.order_id INTO target_order_id
    FROM public.payments p WHERE p.id = p_payment_id AND p.gateway = 'chip';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment reservation not found' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.orders o WHERE o.id = target_order_id FOR UPDATE;
  SELECT p.* INTO attempt FROM public.payments p WHERE p.id = p_payment_id FOR UPDATE;

  IF (p_gateway_payload ->> 'reference') IS DISTINCT FROM attempt.order_id::text
     OR NOT COALESCE(attempt.raw_payload ? '_gasbee_reservation', false) THEN
    RAISE EXCEPTION 'CHIP purchase does not match reservation' USING ERRCODE = '22023';
  END IF;

  IF attempt.gateway_ref = p_gateway_ref THEN RETURN; END IF;
  IF attempt.gateway_ref IS NOT NULL OR attempt.status <> 'pending'
     OR EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.gateway = 'chip' AND p.gateway_ref = p_gateway_ref AND p.id <> p_payment_id
     ) THEN
    RAISE EXCEPTION 'CHIP reservation has already been bound' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payments
  SET gateway_ref = p_gateway_ref,
      raw_payload = (p_gateway_payload - '_gasbee_retired_status')
        || pg_catalog.jsonb_build_object('_gasbee_reservation', true)
  WHERE id = p_payment_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.retire_chip_order_payment(
  p_payment_id uuid,
  p_gateway_ref text,
  p_verified_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  target_order_id uuid;
BEGIN
  IF p_verified_status IS NULL OR p_verified_status NOT IN ('cancelled', 'expired')
     OR NULLIF(p_gateway_ref, '') IS NULL THEN
    RAISE EXCEPTION 'CHIP attempt is not confirmed as permanently unpayable'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.order_id INTO target_order_id
  FROM public.payments p
  WHERE p.id = p_payment_id AND p.gateway = 'chip' AND p.gateway_ref = p_gateway_ref;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHIP purchase not found' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.orders o WHERE o.id = target_order_id FOR UPDATE;
  UPDATE public.payments
  SET status = 'failed',
      raw_payload = COALESCE(raw_payload, '{}'::jsonb)
        || pg_catalog.jsonb_build_object('_gasbee_retired_status', p_verified_status)
  WHERE id = p_payment_id AND status IN ('pending', 'failed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed CHIP purchase cannot be retired' USING ERRCODE = '22023';
  END IF;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.begin_chip_order_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_chip_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retire_chip_order_payment(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_chip_order_payment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_chip_order_payment(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.retire_chip_order_payment(uuid, text, text) TO service_role;

-- Prevent signed customer/staff requests from changing the quoted online
-- purchase after checkout begins. Fulfilment status updates are unaffected.
CREATE OR REPLACE FUNCTION public.protect_reserved_order_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR public.is_admin(actor)
     OR OLD.payment_method IS NOT DISTINCT FROM 'cod'::public.payment_method THEN
    RETURN NEW;
  END IF;
  IF (
    NEW.address_snapshot IS DISTINCT FROM OLD.address_snapshot
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
    OR NEW.items_subtotal IS DISTINCT FROM OLD.items_subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.service_fee IS DISTINCT FROM OLD.service_fee
    OR NEW.processing_fee IS DISTINCT FROM OLD.processing_fee
    OR NEW.discount IS DISTINCT FROM OLD.discount
    OR NEW.gas_exchange_fee IS DISTINCT FROM OLD.gas_exchange_fee
    OR NEW.gas_exchange_type IS DISTINCT FROM OLD.gas_exchange_type
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR NEW.promotion_code IS DISTINCT FROM OLD.promotion_code
  ) AND EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = OLD.id) THEN
    RAISE EXCEPTION 'Online order details are fixed once checkout begins'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_reserved_order_quote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_reserved_order_quote ON public.orders;
CREATE TRIGGER trg_protect_reserved_order_quote
BEFORE UPDATE OF address_snapshot, customer_id, merchant_id, items_subtotal,
  delivery_fee, service_fee, processing_fee, discount, gas_exchange_fee, gas_exchange_type,
  total_amount, promotion_code ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_reserved_order_quote();

COMMIT;

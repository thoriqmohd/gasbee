-- Install before deploying chip-webhook. Payment and order state commit together.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.apply_chip_collect_notification(
  p_purchase jsonb,
  p_configured_brand text,
  p_configured_is_test boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  purchase_id text := p_purchase ->> 'id';
  reference_id text := p_purchase ->> 'reference';
  provider_status text := p_purchase ->> 'status';
  provider_brand text := p_purchase ->> 'brand_id';
  provider_is_test boolean;
  cents numeric;
  is_charged boolean;
  is_closed boolean;
  bound_id uuid;
  matches bigint;
  expected_brand text;
  expected_is_test boolean;
  attempt_id text := p_purchase #>> '{purchase,metadata,gasbee_payment_id}';
  needs_binding boolean := false;
  callback_facts jsonb;
  locked_order public.orders%ROWTYPE;
  payment public.payments%ROWTYPE;
  movement public.fund_movements%ROWTYPE;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF purchase_id IS NULL OR purchase_id !~* uuid_pattern
     OR reference_id IS NULL OR pg_catalog.regexp_replace(reference_id, '^topup:', '') !~* uuid_pattern
     OR provider_brand IS NULL OR provider_brand !~* uuid_pattern
     OR provider_status IS NULL
     OR (attempt_id IS NOT NULL AND attempt_id !~* uuid_pattern)
     OR pg_catalog.jsonb_typeof(p_purchase -> 'is_test') IS DISTINCT FROM 'boolean'
     OR pg_catalog.jsonb_typeof(p_purchase -> 'marked_as_paid') IS DISTINCT FROM 'boolean'
     OR (p_purchase #>> '{purchase,currency}') IS DISTINCT FROM 'MYR'
     OR pg_catalog.jsonb_typeof(p_purchase #> '{purchase,total}') IS DISTINCT FROM 'number'
     OR (p_purchase #>> '{purchase,total}') !~ '^[1-9][0-9]{0,15}$' THEN
    RETURN pg_catalog.jsonb_build_object('result', 'rejected');
  END IF;

  cents := (p_purchase #>> '{purchase,total}')::numeric;
  provider_is_test := (p_purchase ->> 'is_test')::boolean;
  is_charged := provider_status IN ('paid', 'cleared', 'settled');
  is_closed := provider_status IN ('cancelled', 'expired');
  IF is_charged AND (p_purchase ->> 'marked_as_paid')::boolean THEN
    RETURN pg_catalog.jsonb_build_object('result', 'rejected');
  END IF;
  IF NOT is_charged AND NOT is_closed THEN
    RETURN pg_catalog.jsonb_build_object('result', 'no_change');
  END IF;

  IF reference_id LIKE 'topup:%' THEN
    -- A top-up is stored separately and has no legacy raw_payload snapshot.
    -- Fail closed if its current merchant brand/mode cannot be matched.
    SELECT m.* INTO movement
    FROM public.fund_movements m
    WHERE m.id = pg_catalog.substr(reference_id, 7)::uuid
      AND m.chip_purchase_id = purchase_id AND m.direction = 'bank_to_chip'
    FOR UPDATE;
    IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('result', 'unknown_purchase'); END IF;
    IF movement.amount IS NULL OR movement.amount <= 0 OR movement.amount * 100 IS DISTINCT FROM cents
       OR provider_brand IS DISTINCT FROM p_configured_brand
       OR provider_is_test IS DISTINCT FROM p_configured_is_test THEN
      RETURN pg_catalog.jsonb_build_object('result', 'rejected');
    END IF;
    IF provider_is_test THEN RETURN pg_catalog.jsonb_build_object('result', 'test_ignored'); END IF;
    IF movement.status = 'paid' OR (is_closed AND movement.status = 'failed') THEN
      RETURN pg_catalog.jsonb_build_object('result', 'duplicate');
    END IF;
    IF movement.status NOT IN ('pending', 'failed') OR movement.status IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('result', 'review');
    END IF;
    UPDATE public.fund_movements m SET status = CASE WHEN is_charged THEN 'paid' ELSE 'failed' END
    WHERE m.id = movement.id;
    RETURN pg_catalog.jsonb_build_object('result', 'applied');
  END IF;

  SELECT count(*), min(p.id::text)::uuid INTO matches, bound_id
  FROM public.payments p WHERE p.gateway = 'chip' AND p.gateway_ref = purchase_id;
  IF matches > 1 THEN RETURN pg_catalog.jsonb_build_object('result', 'rejected'); END IF;
  IF matches = 0 THEN
    -- Recover a reserved purchase after a lost creation response. CHIP's API
    -- supplies this correlation ID after the signed callback is verified.
    IF attempt_id IS NULL THEN RETURN pg_catalog.jsonb_build_object('result', 'unknown_purchase'); END IF;
    bound_id := attempt_id::uuid;
    needs_binding := true;
  END IF;

  -- Keep the reservation RPC's row lock order to serialize concurrent replies.
  SELECT o.* INTO locked_order FROM public.orders o WHERE o.id = reference_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('result', 'rejected'); END IF;
  SELECT p.* INTO payment FROM public.payments p
  WHERE p.id = bound_id AND p.order_id = locked_order.id AND p.gateway = 'chip'
    AND (p.gateway_ref = purchase_id OR (
      needs_binding AND p.gateway_ref IS NULL AND p.status = 'pending'
        AND p.raw_payload -> '_gasbee_reservation' = 'true'::jsonb
    ))
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('result', CASE WHEN needs_binding THEN 'unknown_purchase' ELSE 'rejected' END);
  END IF;
  IF needs_binding AND payment.gateway_ref IS NULL AND EXISTS (
    SELECT 1 FROM public.payments p WHERE p.gateway = 'chip' AND p.gateway_ref = purchase_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('result', 'rejected');
  END IF;

  expected_brand := COALESCE(NULLIF(payment.raw_payload ->> 'brand_id', ''), p_configured_brand);
  expected_is_test := CASE WHEN pg_catalog.jsonb_typeof(payment.raw_payload -> 'is_test') = 'boolean'
    THEN (payment.raw_payload ->> 'is_test')::boolean ELSE p_configured_is_test END;
  IF payment.amount IS NULL OR payment.amount <= 0 OR payment.amount * 100 IS DISTINCT FROM cents
     OR provider_brand IS DISTINCT FROM expected_brand
     OR provider_is_test IS DISTINCT FROM expected_is_test
     OR (attempt_id IS NOT NULL AND attempt_id IS DISTINCT FROM payment.id::text)
     OR (payment.raw_payload ? '_gasbee_reservation' AND attempt_id IS DISTINCT FROM payment.id::text) THEN
    RETURN pg_catalog.jsonb_build_object('result', 'rejected');
  END IF;
  IF provider_is_test THEN RETURN pg_catalog.jsonb_build_object('result', 'test_ignored'); END IF;

  IF payment.status IN ('paid', 'refunded', 'partial_refund') THEN
    IF payment.raw_payload ? '_gasbee_callback_review' THEN
      RETURN pg_catalog.jsonb_build_object('result', 'review');
    END IF;
    -- Old callbacks may have written the payment before failing to write the order.
    IF NOT (is_charged AND payment.status = 'paid' AND locked_order.payment_status IN ('pending', 'failed')) THEN
      RETURN pg_catalog.jsonb_build_object('result', 'duplicate');
    END IF;
  END IF;

  callback_facts := pg_catalog.jsonb_build_object('_gasbee_callback_status', provider_status);
  IF needs_binding AND payment.gateway_ref IS NULL THEN
    UPDATE public.payments p
    SET gateway_ref = purchase_id, raw_payload = COALESCE(p.raw_payload, '{}'::jsonb) || p_purchase
    WHERE p.id = payment.id;
  END IF;
  IF is_closed THEN
    IF payment.status = 'failed' AND (payment.raw_payload ? '_gasbee_retired_status') THEN
      RETURN pg_catalog.jsonb_build_object('result', 'duplicate');
    END IF;
    UPDATE public.payments p SET status = 'failed', raw_payload = COALESCE(p.raw_payload, '{}'::jsonb)
      || callback_facts || pg_catalog.jsonb_build_object('_gasbee_retired_status', provider_status)
    WHERE p.id = payment.id;
    IF locked_order.status = 'pending' AND locked_order.payment_status = 'pending'
       AND NOT EXISTS (
          SELECT 1 FROM public.payments p WHERE p.order_id = locked_order.id AND p.id <> payment.id
          AND (
            p.status IN ('pending', 'paid', 'refunded', 'partial_refund')
            OR (p.gateway = 'chip' AND NOT COALESCE(p.raw_payload ? '_gasbee_retired_status', false))
          )
       ) THEN
      UPDATE public.orders SET payment_status = 'failed' WHERE id = locked_order.id;
    END IF;
    RETURN pg_catalog.jsonb_build_object('result', 'applied');
  END IF;

  -- Preserve evidence of late, competing or mismatched charges. Do not start
  -- fulfilment or deduct stock if the underlying order requires review.
  IF locked_order.payment_method IS NULL OR locked_order.payment_method = 'cod'
     OR locked_order.status IS NULL OR locked_order.status NOT IN ('pending', 'accepted')
     OR locked_order.payment_status IS NULL OR locked_order.payment_status NOT IN ('pending', 'failed')
     OR locked_order.total_amount IS NULL OR locked_order.total_amount * 100 IS DISTINCT FROM cents
     OR NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = locked_order.id)
     OR EXISTS (
       SELECT 1 FROM public.payments p WHERE p.order_id = locked_order.id AND p.id <> payment.id
         AND p.status IN ('paid', 'refunded', 'partial_refund')
     ) THEN
    UPDATE public.payments p SET status = 'paid', raw_payload = COALESCE(p.raw_payload, '{}'::jsonb)
      || callback_facts || pg_catalog.jsonb_build_object('_gasbee_callback_review', true)
    WHERE p.id = payment.id;
    RETURN pg_catalog.jsonb_build_object('result', 'review');
  END IF;

  UPDATE public.payments p SET status = 'paid', raw_payload = COALESCE(p.raw_payload, '{}'::jsonb) || callback_facts
  WHERE p.id = payment.id;
  UPDATE public.orders SET payment_status = 'paid' WHERE id = locked_order.id;
  RETURN pg_catalog.jsonb_build_object('result', 'applied');
END
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_chip_collect_notification(jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_chip_collect_notification(jsonb, text, boolean) TO service_role;
COMMIT;

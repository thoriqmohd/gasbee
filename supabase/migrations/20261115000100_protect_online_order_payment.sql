BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.protect_order_gateway_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
BEGIN
  -- Server workers and existing finance administrators retain their workflows.
  IF actor IS NULL OR public.is_admin(actor) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_method IS DISTINCT FROM 'cod'::public.payment_method
       AND NEW.payment_status IS DISTINCT FROM 'pending'::public.payment_status THEN
      RAISE EXCEPTION 'Online orders must start with pending payment'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'Only an authorised payment service can change the payment method'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.payment_method IS DISTINCT FROM 'cod'::public.payment_method
     AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Only an authorised payment service can change online payment status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_order_gateway_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_order_gateway_fields ON public.orders;
CREATE TRIGGER trg_protect_order_gateway_fields
BEFORE INSERT OR UPDATE OF payment_method, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_gateway_fields();

CREATE OR REPLACE FUNCTION public.protect_order_items_after_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  parent_order public.orders%ROWTYPE;
BEGIN
  -- Existing order maintenance jobs and authorised administrators may still repair records.
  IF actor IS NULL OR public.is_admin(actor) THEN
    RETURN NEW;
  END IF;

  SELECT o.* INTO parent_order
    FROM public.orders AS o
    WHERE o.id = NEW.order_id
    FOR UPDATE;

  -- Keep errors generic so a guessed order ID doesn't disclose its state.
  IF NOT FOUND OR parent_order.customer_id IS DISTINCT FROM actor
     OR parent_order.status IS DISTINCT FROM 'pending'::public.order_status
     OR parent_order.payment_status IS DISTINCT FROM 'pending'::public.payment_status
     OR EXISTS (
       SELECT 1 FROM public.payments AS p WHERE p.order_id = NEW.order_id
     ) THEN
    RAISE EXCEPTION 'Order items can only be added before payment begins'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.protect_order_items_after_checkout() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_order_items_after_checkout ON public.order_items;
CREATE TRIGGER trg_protect_order_items_after_checkout
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.protect_order_items_after_checkout();
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_trigger
      WHERE (tgrelid, tgname) IN (('public.orders'::regclass, 'trg_protect_order_gateway_fields'),
                                  ('public.order_items'::regclass, 'trg_protect_order_items_after_checkout'))
        AND tgenabled = 'O') <> 2 THEN
    RAISE EXCEPTION 'Expected both online order guards to be enabled';
  END IF;
END
$verify$;
COMMIT;
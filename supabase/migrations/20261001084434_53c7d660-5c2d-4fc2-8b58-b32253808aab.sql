ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS property_type text NULL,
  ADD COLUMN IF NOT EXISTS floor text NULL,
  ADD COLUMN IF NOT EXISTS unit_no text NULL;
ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_property_type_check;
ALTER TABLE public.addresses ADD CONSTRAINT addresses_property_type_check
  CHECK (property_type IS NULL OR property_type IN ('landed','highrise'));

INSERT INTO public.app_settings (key, value) VALUES ('service_fee_highrise', '{"value": 8}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_fee_settings()
 RETURNS TABLE(key text, value jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.key, s.value FROM public.app_settings s
  WHERE s.key IN ('service_fee','service_fee_highrise','delivery_base_fee','delivery_base_km','delivery_per_km','processing_fee',
    'gas_exchange_fee','dev_mode_enabled','dev_mode_title','dev_mode_message','dev_mode_button');
$function$;

CREATE OR REPLACE FUNCTION public.order_insert_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); ptype text; aid uuid;
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
  NEW.service_fee := CASE WHEN ptype = 'highrise'
    THEN public.setting_numeric('service_fee_highrise', 8)
    ELSE public.setting_numeric('service_fee', 5) END;
  NEW.processing_fee := public.setting_numeric('processing_fee', 0);
  NEW.delivery_fee := LEAST(GREATEST(COALESCE(NEW.delivery_fee, 0), public.setting_numeric('delivery_base_fee', 0)), 500);
  NEW.discount := GREATEST(COALESCE(NEW.discount, 0), 0);
  NEW.gas_exchange_fee := 0;
  NEW.items_subtotal := 0;
  NEW.total_amount := 0;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.audit_service_fee_pricing()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE old_v text; new_v text;
BEGIN
  IF NEW.key NOT IN ('service_fee','service_fee_highrise') THEN RETURN NEW; END IF;
  old_v := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.value->>'value', OLD.value #>> '{}') END;
  new_v := COALESCE(NEW.value->>'value', NEW.value #>> '{}');
  IF old_v IS NOT DISTINCT FROM new_v THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity, payload)
  VALUES (auth.uid(), 'service_fee_pricing_changed', 'app_settings',
    jsonb_build_object('setting', NEW.key,
      'property_type', CASE WHEN NEW.key = 'service_fee' THEN 'landed' ELSE 'highrise' END,
      'old_value', old_v, 'new_value', new_v));
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_audit_service_fee_pricing ON public.app_settings;
CREATE TRIGGER trg_audit_service_fee_pricing AFTER INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_service_fee_pricing();
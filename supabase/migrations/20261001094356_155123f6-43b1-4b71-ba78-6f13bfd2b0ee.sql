INSERT INTO public.app_settings (key, value) VALUES ('highrise_delivery_surcharge', '{"value":3}'::jsonb) ON CONFLICT (key) DO NOTHING;
DELETE FROM public.app_settings WHERE key = 'service_fee_highrise';

CREATE OR REPLACE FUNCTION public.get_public_fee_settings()
 RETURNS TABLE(key text, value jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.key, s.value FROM public.app_settings s
  WHERE s.key IN ('service_fee','highrise_delivery_surcharge','delivery_base_fee','delivery_base_km','delivery_per_km','processing_fee',
    'gas_exchange_fee','dev_mode_enabled','dev_mode_title','dev_mode_message','dev_mode_button');
$$;

CREATE OR REPLACE FUNCTION public.order_insert_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); ptype text; aid uuid; base numeric;
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
  base := LEAST(GREATEST(COALESCE(NEW.delivery_fee, 0), public.setting_numeric('delivery_base_fee', 0)), 500);
  NEW.delivery_fee := ROUND(base + CASE WHEN ptype = 'highrise' THEN public.setting_numeric('highrise_delivery_surcharge', 3) ELSE 0 END, 2);
  NEW.discount := GREATEST(COALESCE(NEW.discount, 0), 0);
  NEW.gas_exchange_fee := 0;
  NEW.items_subtotal := 0;
  NEW.total_amount := 0;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.audit_service_fee_pricing()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE old_v text; new_v text;
BEGIN
  IF NEW.key NOT IN ('service_fee','highrise_delivery_surcharge') THEN RETURN NEW; END IF;
  old_v := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.value->>'value', OLD.value #>> '{}') END;
  new_v := COALESCE(NEW.value->>'value', NEW.value #>> '{}');
  IF old_v IS NOT DISTINCT FROM new_v THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity, payload)
  VALUES (auth.uid(),
    CASE WHEN NEW.key = 'service_fee' THEN 'service_fee_pricing_changed' ELSE 'delivery_surcharge_changed' END,
    'app_settings',
    jsonb_build_object('setting', NEW.key, 'old_value', old_v, 'new_value', new_v));
  RETURN NEW;
END $$;
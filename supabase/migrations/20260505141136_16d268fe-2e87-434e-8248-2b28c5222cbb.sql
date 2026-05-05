
-- Trigger to update rider/merchant aggregate ratings
CREATE OR REPLACE FUNCTION public.update_rating_aggregates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m_id uuid;
  r_id uuid;
BEGIN
  SELECT merchant_id, rider_id INTO m_id, r_id FROM public.orders WHERE id = NEW.order_id;
  IF m_id IS NOT NULL AND NEW.merchant_rating IS NOT NULL THEN
    UPDATE public.merchants SET rating = (
      SELECT ROUND(AVG(r.merchant_rating)::numeric, 2)
      FROM public.ratings r JOIN public.orders o ON o.id = r.order_id
      WHERE o.merchant_id = m_id AND r.merchant_rating IS NOT NULL
    ) WHERE id = m_id;
  END IF;
  IF r_id IS NOT NULL AND NEW.rider_rating IS NOT NULL THEN
    UPDATE public.riders SET rating = (
      SELECT ROUND(AVG(r.rider_rating)::numeric, 2)
      FROM public.ratings r JOIN public.orders o ON o.id = r.order_id
      WHERE o.rider_id = r_id AND r.rider_rating IS NOT NULL
    ) WHERE id = r_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_rating_aggregates ON public.ratings;
CREATE TRIGGER trg_update_rating_aggregates
AFTER INSERT ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.update_rating_aggregates();

-- Storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "delivery proofs public read" ON storage.objects
FOR SELECT USING (bucket_id = 'delivery-proofs');

CREATE POLICY "delivery proofs auth upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery-proofs');

CREATE POLICY "delivery proofs auth update" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'delivery-proofs');

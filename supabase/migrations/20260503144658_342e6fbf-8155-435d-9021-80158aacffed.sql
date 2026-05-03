
-- Add rider doc fields
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS license_image_url text,
  ADD COLUMN IF NOT EXISTS license_expiry_date date,
  ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Storage buckets (public read for logos/products/profile; license in same public bucket but path-scoped)
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-logos','merchant-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images','product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('rider-docs','rider-docs', true) ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "public read merchant-logos" ON storage.objects FOR SELECT USING (bucket_id = 'merchant-logos');
CREATE POLICY "public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "public read rider-docs" ON storage.objects FOR SELECT USING (bucket_id = 'rider-docs');

-- Authenticated write (any auth user can upload to these buckets — admin/merchant flows control via app logic)
CREATE POLICY "auth upload merchant-logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'merchant-logos');
CREATE POLICY "auth update merchant-logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'merchant-logos');
CREATE POLICY "auth delete merchant-logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'merchant-logos');

CREATE POLICY "auth upload product-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth update product-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth delete product-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "auth upload rider-docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rider-docs');
CREATE POLICY "auth update rider-docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'rider-docs');
CREATE POLICY "auth delete rider-docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rider-docs');

-- Enable realtime for orders so merchants get instant notifications
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

DROP POLICY IF EXISTS "company-docs read" ON storage.objects;
DROP POLICY IF EXISTS "company-docs insert" ON storage.objects;
DROP POLICY IF EXISTS "company-docs update" ON storage.objects;
DROP POLICY IF EXISTS "company-docs delete" ON storage.objects;
CREATE POLICY "company-docs read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-docs' AND (public.is_admin(auth.uid()) OR ((storage.foldername(name))[1] = 'u-' || auth.uid()::text AND owner_id = auth.uid()::text)));
CREATE POLICY "company-docs insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-docs' AND (public.is_admin(auth.uid()) OR ((storage.foldername(name))[1] = 'u-' || auth.uid()::text AND owner_id = auth.uid()::text)));
CREATE POLICY "company-docs update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-docs' AND (public.is_admin(auth.uid()) OR ((storage.foldername(name))[1] = 'u-' || auth.uid()::text AND owner_id = auth.uid()::text)));
CREATE POLICY "company-docs delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-docs' AND (public.is_admin(auth.uid()) OR ((storage.foldername(name))[1] = 'u-' || auth.uid()::text AND owner_id = auth.uid()::text)));
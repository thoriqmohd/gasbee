
-- Storage bucket for banners
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "banners public read" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "banners admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners' AND public.is_admin(auth.uid()));
CREATE POLICY "banners admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners' AND public.is_admin(auth.uid()));
CREATE POLICY "banners admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners' AND public.is_admin(auth.uid()));

-- Allow customer to update their own address
-- (already covered by ALL policy on addresses for own user)

-- Track Billplz bills mapped to orders (use payments.gateway_ref)
-- No schema changes needed; payment_method enum may need 'fpx','card','ewallet' check
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'payment_method' AND e.enumlabel = 'fpx') THEN
    ALTER TYPE payment_method ADD VALUE 'fpx';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'payment_method' AND e.enumlabel = 'card') THEN
    ALTER TYPE payment_method ADD VALUE 'card';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'payment_method' AND e.enumlabel = 'ewallet') THEN
    ALTER TYPE payment_method ADD VALUE 'ewallet';
  END IF;
END $$;

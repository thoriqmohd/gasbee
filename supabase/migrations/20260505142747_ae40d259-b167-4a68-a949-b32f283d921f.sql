
-- 1. Seed categories
INSERT INTO public.categories (name, slug, sort_order, is_active)
VALUES ('Cylinder Gas', 'cylinder', 1, true)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, sort_order, is_active)
VALUES ('Accessories', 'accessories', 2, true)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, sort_order, is_active)
VALUES ('Industrial Gas', 'industrial-gas', 3, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Company verifications
DO $$ BEGIN
  CREATE TYPE public.company_verification_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.company_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  ssm_number text NOT NULL,
  contact_phone text,
  business_address text,
  ssm_doc_url text NOT NULL,
  additional_doc_url text,
  status public.company_verification_status NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user create own verification" ON public.company_verifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user view own or admin" ON public.company_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "user update own pending or admin" ON public.company_verifications
  FOR UPDATE TO authenticated USING ((user_id = auth.uid() AND status = 'pending') OR is_admin(auth.uid()));

CREATE TRIGGER trg_cv_updated BEFORE UPDATE ON public.company_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Storage bucket for company docs
INSERT INTO storage.buckets (id, name, public) VALUES ('company-docs', 'company-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth upload company docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-docs');
CREATE POLICY "public read company docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'company-docs');

-- 4. Refund flow extensions
DO $$ BEGIN
  CREATE TYPE public.refund_stage AS ENUM ('pre_dispatch','in_transit','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_pickup_status AS ENUM ('not_required','pending','picked_up','returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS stage public.refund_stage,
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS delivery_fee_charged numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restocking_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS pickup_status public.refund_pickup_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS pickup_rider_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_proof_url text,
  ADD COLUMN IF NOT EXISTS pickup_completed_at timestamptz;

-- Allow rider assigned to refund pickup to update refund row
DROP POLICY IF EXISTS "rider update assigned refund" ON public.refunds;
CREATE POLICY "rider update assigned refund" ON public.refunds
  FOR UPDATE TO authenticated USING (
    pickup_rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );

ALTER TABLE public.refunds 
  ADD COLUMN IF NOT EXISTS merchant_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_acknowledged_by uuid;
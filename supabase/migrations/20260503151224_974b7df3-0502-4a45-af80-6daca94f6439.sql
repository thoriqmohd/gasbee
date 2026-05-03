
-- Order chat messages between customer & rider (and merchant)
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view order messages" ON public.order_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
    o.customer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR o.merchant_id = public.user_merchant_id(auth.uid())
    OR o.rider_id IN (SELECT r.id FROM public.riders r WHERE r.user_id = auth.uid())
  )
));

CREATE POLICY "send order messages" ON public.order_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      o.customer_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR o.merchant_id = public.user_merchant_id(auth.uid())
      OR o.rider_id IN (SELECT r.id FROM public.riders r WHERE r.user_id = auth.uid())
    )
  )
);

CREATE INDEX idx_order_messages_order ON public.order_messages(order_id, created_at);

-- Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER TABLE public.riders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.riders;

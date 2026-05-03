
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS merchant_id uuid;

CREATE POLICY "merchant view tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (merchant_id IS NOT NULL AND merchant_id = public.user_merchant_id(auth.uid()));

CREATE POLICY "merchant update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (merchant_id IS NOT NULL AND merchant_id = public.user_merchant_id(auth.uid()));

-- Allow merchant to view & post messages on tickets directed at them
DROP POLICY IF EXISTS "view ticket msgs" ON public.ticket_messages;
CREATE POLICY "view ticket msgs" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (t.opened_by = auth.uid() OR t.assigned_to = auth.uid() OR public.is_admin(auth.uid())
           OR (t.merchant_id IS NOT NULL AND t.merchant_id = public.user_merchant_id(auth.uid())))
  ));

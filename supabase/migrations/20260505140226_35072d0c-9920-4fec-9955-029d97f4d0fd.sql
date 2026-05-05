
-- Notify merchant team on new order
CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT ur.user_id,
         'New order ' || NEW.code,
         'Total: RM ' || COALESCE(NEW.total_amount::text,'0') || ' · ' || COALESCE(NEW.address_snapshot->>'recipient_name',''),
         'order',
         '/merchant/orders/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.merchant_id = NEW.merchant_id
    AND ur.role IN ('merchant_owner','merchant_manager','merchant_staff');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_merchant_new_order ON public.orders;
CREATE TRIGGER trg_notify_merchant_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_new_order();

-- Deduct stock + log movement when order becomes paid
CREATE OR REPLACE FUNCTION public.deduct_stock_on_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it RECORD;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'pending') <> 'paid') THEN
    FOR it IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      UPDATE public.products
        SET stock_qty = GREATEST(0, stock_qty - it.quantity)
        WHERE id = it.product_id;
      INSERT INTO public.inventory_movements (product_id, merchant_id, quantity, type, reason, reference_order_id)
      VALUES (it.product_id, NEW.merchant_id, it.quantity, 'out', 'Order ' || NEW.code || ' paid', NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_paid ON public.orders;
CREATE TRIGGER trg_deduct_stock_on_paid
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_paid();

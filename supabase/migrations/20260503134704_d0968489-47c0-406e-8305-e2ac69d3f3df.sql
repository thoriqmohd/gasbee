
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','admin','operation_admin','finance_admin','support_admin',
  'merchant_owner','merchant_manager','merchant_staff',
  'merchant_rider','rider',
  'customer','buyer'
);

CREATE TYPE public.merchant_status AS ENUM ('pending','active','suspended','rejected');
CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.rider_status AS ENUM ('offline','online','busy','suspended');
CREATE TYPE public.order_status AS ENUM (
  'pending','accepted','rejected','preparing','assigned',
  'rider_accepted','arrived_at_merchant','picked_up','on_delivery',
  'arrived_at_customer','delivered','failed','cancelled','refunded'
);
CREATE TYPE public.delivery_type AS ENUM ('immediate','scheduled');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded','partial_refund');
CREATE TYPE public.payment_method AS ENUM ('fpx','card','ewallet','cod','billplz','toyyibpay','ipay88');
CREATE TYPE public.refund_status AS ENUM ('requested','approved','rejected','processed');
CREATE TYPE public.settlement_status AS ENUM ('pending','processing','paid','failed');
CREATE TYPE public.inventory_movement_type AS ENUM ('in','out','reserved','released','adjustment');
CREATE TYPE public.order_item_type AS ENUM ('refill','new_cylinder','deposit');
CREATE TYPE public.notification_type AS ENUM ('order','payment','promotion','system','support');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.commission_type AS ENUM ('percent','flat');
CREATE TYPE public.promotion_type AS ENUM ('percent','flat','free_delivery');

-- =========================================================
-- UTILITY: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  merchant_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, merchant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin','admin','operation_admin','finance_admin','support_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_merchant_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT merchant_id FROM public.user_roles
  WHERE user_id = _user_id
    AND role IN ('merchant_owner','merchant_manager','merchant_staff','merchant_rider')
    AND merchant_id IS NOT NULL
  LIMIT 1;
$$;

-- =========================================================
-- handle_new_user trigger: profile + default customer role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- MERCHANTS
-- =========================================================
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  status public.merchant_status NOT NULL DEFAULT 'pending',
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  documents JSONB DEFAULT '[]'::jsonb,
  rating NUMERIC(3,2) DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_merchants_updated BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- merchant_id FK on user_roles (deferred so merchants table exists)
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_merchant_fk FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;

-- =========================================================
-- MERCHANT APPLICATIONS
-- =========================================================
CREATE TABLE public.merchant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  status public.application_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_mapps_updated BEFORE UPDATE ON public.merchant_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RIDERS
-- =========================================================
CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT,
  vehicle_plate TEXT,
  license_no TEXT,
  status public.rider_status NOT NULL DEFAULT 'offline',
  current_lat NUMERIC(10,7),
  current_lng NUMERIC(10,7),
  rating NUMERIC(3,2) DEFAULT 0,
  total_deliveries INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_riders_updated BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cats_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cylinder_size_kg NUMERIC(6,2),
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  refill_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_cylinder_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_qty INT NOT NULL DEFAULT 0,
  reserved_qty INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- INVENTORY MOVEMENTS
-- =========================================================
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  type public.inventory_movement_type NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  reference_order_id UUID,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ADDRESSES
-- =========================================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_addr_updated BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- ORDERS
-- =========================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT 'GB-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  address_snapshot JSONB NOT NULL,
  items_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method,
  status public.order_status NOT NULL DEFAULT 'pending',
  delivery_type public.delivery_type NOT NULL DEFAULT 'immediate',
  scheduled_at TIMESTAMPTZ,
  notes TEXT,
  promotion_code TEXT,
  proof_of_delivery_url TEXT,
  delivery_notes TEXT,
  failure_reason TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_merchant ON public.orders(merchant_id);
CREATE INDEX idx_orders_rider ON public.orders(rider_id);
CREATE INDEX idx_orders_status ON public.orders(status);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  cylinder_size_kg NUMERIC(6,2),
  type public.order_item_type NOT NULL DEFAULT 'refill',
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PAYMENTS / REFUNDS / SETTLEMENTS / COMMISSIONS
-- =========================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  gateway_ref TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pay_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'requested',
  processed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_refund_updated BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_set_updated BEFORE UPDATE ON public.settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  type public.commission_type NOT NULL DEFAULT 'percent',
  value NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_com_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BANNERS / PROMOTIONS / NOTIFICATIONS / SUPPORT / RATINGS / AUDIT / SETTINGS
-- =========================================================
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ban_updated BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  type public.promotion_type NOT NULL DEFAULT 'percent',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  usage_limit INT,
  used_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_promo_updated BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type public.notification_type NOT NULL DEFAULT 'system',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  context_role TEXT,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tick_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_rating INT CHECK (merchant_rating BETWEEN 1 AND 5),
  rider_rating INT CHECK (rider_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sett_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "view own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "view own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- merchants
CREATE POLICY "public read active merchants" ON public.merchants FOR SELECT TO authenticated
  USING (status = 'active' OR owner_id = auth.uid() OR public.is_admin(auth.uid())
         OR id = public.user_merchant_id(auth.uid()));
CREATE POLICY "owner or admin update merchant" ON public.merchants FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid())
         OR (id = public.user_merchant_id(auth.uid()) AND public.has_role(auth.uid(),'merchant_manager')));
CREATE POLICY "admin insert merchant" ON public.merchants FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin delete merchant" ON public.merchants FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- merchant_applications
CREATE POLICY "applicant or admin view app" ON public.merchant_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "anyone create app" ON public.merchant_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "admin update app" ON public.merchant_applications FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- riders
CREATE POLICY "view riders" ON public.riders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR merchant_id = public.user_merchant_id(auth.uid())
  );
CREATE POLICY "rider self update" ON public.riders FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid())
         OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "merchant or admin add rider" ON public.riders FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "merchant or admin del rider" ON public.riders FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));

-- categories: public read, admin write
CREATE POLICY "read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- products
CREATE POLICY "read active or own products" ON public.products FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "merchant or admin write products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));

-- inventory_movements
CREATE POLICY "view inventory" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "write inventory" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));

-- addresses
CREATE POLICY "own addresses" ON public.addresses FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- orders
CREATE POLICY "view related orders" ON public.orders FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR merchant_id = public.user_merchant_id(auth.uid())
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "customer create order" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "update related orders" ON public.orders FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR merchant_id = public.user_merchant_id(auth.uid())
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );

-- order_items: same access as parent order
CREATE POLICY "view related items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
    o.customer_id = auth.uid() OR public.is_admin(auth.uid())
    OR o.merchant_id = public.user_merchant_id(auth.uid())
    OR o.rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  )));
CREATE POLICY "insert items by customer" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

-- payments
CREATE POLICY "view related payments" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
    o.customer_id = auth.uid() OR public.is_admin(auth.uid())
    OR o.merchant_id = public.user_merchant_id(auth.uid())
  )));
CREATE POLICY "admin write payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- refunds
CREATE POLICY "view refunds" ON public.refunds FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.merchant_id = public.user_merchant_id(auth.uid())));
CREATE POLICY "request refund" ON public.refunds FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "admin update refund" ON public.refunds FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- settlements
CREATE POLICY "view settlements" ON public.settlements FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "admin manage settlements" ON public.settlements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- commissions
CREATE POLICY "view commissions" ON public.commissions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR merchant_id = public.user_merchant_id(auth.uid()));
CREATE POLICY "admin write commissions" ON public.commissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- banners / promotions: public read (active)
CREATE POLICY "read active banners" ON public.banners FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admin write banners" ON public.banners FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "read active promotions" ON public.promotions FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admin write promotions" ON public.promotions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- notifications
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "update own notification" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin insert notification" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- support_tickets
CREATE POLICY "view tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (opened_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "create ticket" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());
CREATE POLICY "update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (opened_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "view ticket msgs" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (
    t.opened_by = auth.uid() OR t.assigned_to = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "send ticket msg" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- ratings
CREATE POLICY "read ratings" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "customer create rating" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- audit logs
CREATE POLICY "admin view audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "admin insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- app settings
CREATE POLICY "read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- SEED CATEGORIES
-- =========================================================
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('LPG Refill','lpg-refill','flame',1),
  ('New Cylinder','new-cylinder','cylinder',2),
  ('Accessories','accessories','wrench',3),
  ('Industrial Gas','industrial-gas','factory',4)
ON CONFLICT (slug) DO NOTHING;

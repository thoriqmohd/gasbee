const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migrationDir = path.resolve(__dirname, '../../migrations');
const migration = (name) => fs.readFileSync(path.join(migrationDir, name), 'utf8');
const uid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const buyer = uid(1), otherBuyer = uid(2), merchant = uid(11), otherMerchant = uid(12), inactiveMerchant = uid(13);
const addr = uid(21), farAddr = uid(22), somebodyElseAddr = uid(23), highrise = uid(24);
const refill = uid(31), accessory = uid(32), otherRefill = uid(33), industrial = uid(34);
const soon = uid(35), unavailable = uid(36), inactiveCategoryProduct = uid(37), inactiveMerchantProduct = uid(38);

const schema = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 = '${buyer}'::uuid AND COALESCE(pg_catalog.current_setting('test.admin', true) = 'true',false) $$;
CREATE FUNCTION public.user_merchant_id(uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
CREATE FUNCTION public.setting_numeric(text,numeric) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT $2 $$;
CREATE FUNCTION public.get_public_fee_settings() RETURNS TABLE(key text, value jsonb)
LANGUAGE sql STABLE AS $$ SELECT 'delivery_base_fee', '5'::jsonb $$;
CREATE TYPE public.payment_method AS ENUM ('fpx','card','ewallet','cod');
CREATE TYPE public.payment_status AS ENUM ('pending','failed','paid','refunded','partial_refund');
CREATE TYPE public.order_status AS ENUM ('pending','accepted','cancelled','delivered');
CREATE TYPE public.delivery_type AS ENUM ('immediate','scheduled');
CREATE TYPE public.order_item_type AS ENUM ('refill','new_cylinder','deposit');
CREATE TYPE public.promotion_type AS ENUM ('percent','flat','free_delivery');
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY, user_id uuid, label text, recipient_name text, recipient_phone text,
  address_line1 text, address_line2 text, city text, state text, postcode text,
  latitude numeric, longitude numeric, property_type text, floor text, unit_no text
);
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY, status text, latitude numeric, longitude numeric, delivery_radius_km numeric
);
CREATE TABLE public.categories (id uuid PRIMARY KEY, slug text, is_active boolean);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY, code text DEFAULT 'GB-TEST', customer_id uuid, merchant_id uuid, rider_id uuid,
  address_snapshot jsonb, items_subtotal numeric, delivery_fee numeric, discount numeric,
  total_amount numeric, payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method, status public.order_status NOT NULL DEFAULT 'pending',
  delivery_type public.delivery_type, scheduled_at timestamptz, notes text, promotion_code text,
  accepted_at timestamptz, rejected_at timestamptz, assigned_at timestamptz, picked_up_at timestamptz,
  delivered_at timestamptz, cancelled_at timestamptz, proof_of_delivery_url text, failure_reason text,
  service_fee numeric, processing_fee numeric, gas_exchange_type text, gas_exchange_fee numeric
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY, merchant_id uuid REFERENCES public.merchants, category_id uuid REFERENCES public.categories,
  name text, image_url text, cylinder_size_kg numeric, refill_price numeric, selling_price numeric,
  deposit_amount numeric, new_cylinder_price numeric, is_coming_soon boolean, is_active boolean
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders,
  product_id uuid NOT NULL REFERENCES public.products, product_name text, product_image_url text,
  cylinder_size_kg numeric, quantity int, type public.order_item_type, unit_price numeric, subtotal numeric
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders
);
CREATE TABLE public.company_verifications (user_id uuid, status text, created_at timestamptz DEFAULT now());
CREATE TABLE public.promotions (
  id uuid DEFAULT gen_random_uuid(), code text UNIQUE, type public.promotion_type, value numeric,
  min_order_amount numeric, max_discount numeric, applies_to text DEFAULT 'all', merchant_id uuid,
  usage_limit integer, used_count integer DEFAULT 0, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.order_credits (user_id uuid, amount numeric, status text, used_order_id uuid);
CREATE FUNCTION public.validate_promotion(_code text)
RETURNS TABLE(id uuid,code text,type public.promotion_type,value numeric,min_order_amount numeric,
max_discount numeric,applies_to text,merchant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT p.id,p.code,p.type,p.value,p.min_order_amount,p.max_discount,p.applies_to,p.merchant_id
FROM public.promotions p WHERE p.code = _code AND (p.usage_limit IS NULL OR p.used_count < p.usage_limit) LIMIT 1
$$;

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON public.addresses, public.merchants, public.categories, public.products, public.company_verifications TO authenticated;
GRANT SELECT, INSERT ON public.orders, public.order_items TO authenticated;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_address ON public.addresses FOR SELECT TO authenticated USING (user_id=auth.uid());
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_order_select ON public.orders FOR SELECT TO authenticated USING (customer_id=auth.uid());
CREATE POLICY own_order_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (customer_id=auth.uid());
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_items_select ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id=auth.uid()));
CREATE POLICY own_items_insert ON public.order_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id=auth.uid()));

INSERT INTO public.merchants VALUES
  ('${merchant}','active',3.09,101.54,10), ('${otherMerchant}','active',3.09,101.54,10), ('${inactiveMerchant}','suspended',3.09,101.54,10);
INSERT INTO public.addresses VALUES
 ('${addr}','${buyer}','Home','A','0123','Saved road',NULL,'Shah Alam','Selangor','40000',3.11,101.53,'landed',NULL,NULL),
 ('${farAddr}','${buyer}','Home','A','0123','Far road',NULL,'Johor','Johor','80000',1.49,103.74,'landed',NULL,NULL),
 ('${somebodyElseAddr}','${otherBuyer}','Other','A','0123','Other home',NULL,'Shah Alam','Selangor','40000',3.09,101.53,'landed',NULL,NULL),
 ('${highrise}','${buyer}','Condo','A','0123','Tower road',NULL,'Shah Alam','Selangor','40000',3.11,101.53,'highrise','5','5A');
INSERT INTO public.categories VALUES
 ('${uid(51)}','lpg-refill',true),('${uid(52)}','accessories',true),('${uid(53)}','industrial-gas',true),('${uid(54)}','cylinder',false);
INSERT INTO public.products VALUES
 ('${refill}','${merchant}','${uid(51)}','Gas 12kg',NULL,12,22.80,0,0,0,false,true),
 ('${accessory}','${merchant}','${uid(52)}','Hose',NULL,NULL,0,4.60,0,0,false,true),
 ('${otherRefill}','${otherMerchant}','${uid(51)}','Other',NULL,12,22.80,0,0,0,false,true),
 ('${industrial}','${merchant}','${uid(53)}','Industrial',NULL,26,0,30,0,0,false,true),
 ('${soon}','${merchant}','${uid(51)}','Soon',NULL,12,22.80,0,0,0,true,true),
 ('${unavailable}','${merchant}','${uid(51)}','Unavailable',NULL,12,22.80,0,0,0,false,false),
 ('${inactiveCategoryProduct}','${merchant}','${uid(54)}','No category',NULL,12,0,22.80,0,0,false,true),
 ('${inactiveMerchantProduct}','${inactiveMerchant}','${uid(51)}','Inactive merchant',NULL,12,22.80,0,0,0,false,true);
INSERT INTO public.promotions(code,type,value,min_order_amount,max_discount,applies_to,merchant_id,usage_limit)
VALUES ('SAVE','percent',10,2,NULL,'all',NULL,NULL),
 ('SUBSIDY','free_delivery',0,2,NULL,'all',NULL,NULL),
 ('OTHER','flat',2,2,NULL,'merchant','${otherMerchant}',NULL),
 ('LIMITED','flat',2,2,NULL,'all',NULL,1);
`;

async function main() {
  const db = new PGlite();
  await db.exec(schema);
  const price = migration('20260806100454_6938dffd-2e88-4c73-9750-e4bc2752aede.sql');
  await db.exec(price.slice(0, price.indexOf('-- 2) Order insert guard')));
  const October = migration('20261001071507_e0b30dde-a85a-4b85-bd9a-b360c94571ff.sql');
  const recalc = October.slice(October.indexOf('CREATE OR REPLACE FUNCTION public.order_recalc_totals()'),
    October.indexOf('CREATE OR REPLACE FUNCTION public.orders_customer_update_guard()'));
  await db.exec(recalc);
  await db.exec('CREATE TRIGGER totals AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.order_recalc_totals()');
  const promo = migration('20260531024537_c2029d29-07ad-4be2-ab16-c28b0574f539.sql');
  await db.exec(promo.slice(promo.indexOf('-- Increment used_count')));
  await db.exec(migration('20261115000100_protect_online_order_payment.sql'));
  await db.exec(migration('20261115000200_enforce_delivery_quote.sql'));
  await db.exec('CREATE TRIGGER guard BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.order_insert_guard()');
  await db.exec(migration('20261115002100_create_web_checkout_order.sql'));

  const auth = async (id) => {
    await db.exec(`RESET ROLE; SET request.jwt.claim.sub = '${id || ''}'; SET ROLE authenticated;`);
  };
  const item = (product_id = refill, quantity = 1, type = 'refill') => ({product_id, quantity, type});
  const call = async (id, options = {}) => {
    const { address = addr, items = [item()], delivery = 'immediate', schedule = null, gas = 'petronas', notes = '', promoCode = null } = options;
    const result = await db.query('SELECT public.create_web_checkout_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8) AS order',
      [uid(id),address,JSON.stringify(items),delivery,schedule,gas,notes,promoCode]);
    return result.rows[0].order;
  };
  const checkAbsent = async (id) => {
    const data = await db.query('SELECT count(*) AS n FROM public.orders WHERE id=$1',[uid(id)]);
    assert.equal(Number(data.rows[0].n), 0);
  };

  await db.exec('SET ROLE anon');
  await assert.rejects(() => call(101), {code:'42501'});
  await auth(null);
  await assert.rejects(() => call(101), {code:'42501'});
  await auth(buyer);
  const first = await call(101);
  assert.equal(first.id, uid(101));
  assert.equal(first.total_amount, 32.80);
  assert.equal(first.payment_status, 'pending');
  assert.deepEqual(await call(101), first);
  await assert.rejects(() => call(101, {items:[item(refill,2)]}), /sudah digunakan/);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.order_items')).rows[0].n), 1);
  await assert.rejects(() => call(102, {address:somebodyElseAddr}), /alamat penghantaran yang sah/);
  await assert.rejects(() => call(103, {address:farAddr}), /outside this merchant/);
  await assert.rejects(() => call(104, {items:[item(refill,3)]}), /Maksimum 2 tong/);
  await assert.rejects(() => call(105, {items:[item(),item(otherRefill)]}), /satu peniaga/);
  await assert.rejects(() => call(106, {items:[item(soon)]}), /tidak tersedia/);
  await assert.rejects(() => call(107, {items:[item(unavailable)]}), /tidak tersedia/);
  await assert.rejects(() => call(108, {items:[item(industrial,1,'new_cylinder')],gas:null}), /Akaun syarikat/);
  await assert.rejects(() => call(109, {items:[item(refill,1,'deposit')]}), /tidak tersedia/);
  await assert.rejects(() => call(110, {items:[item(inactiveCategoryProduct,1,'new_cylinder')], gas:null}), /tidak tersedia/);
  await assert.rejects(() => call(111, {items:[item(inactiveMerchantProduct)]}), /tidak tersedia/);
  await assert.rejects(() => call(112, {promoCode:'OTHER'}), /Kod promo tidak sah/);
  await assert.rejects(() => call(113, {promoCode:'LIMITED'}), /Diskaun telah berubah/);
  await assert.rejects(() => call(114, {delivery:'scheduled',schedule:'2020-01-01T00:00:00+08:00'}), /akan datang/);
  await assert.rejects(() => call(115, {items:[item(refill,0)]}), /tidak sah/);
  await assert.rejects(() => call(116, {items:[item(),item()]}), /Gabungkan kuantiti/);
  await assert.rejects(() => call(117, {items:[item(refill,1.4)]}), /tidak sah/);
  for(let i = 102; i <= 117; i++) await checkAbsent(i);
  const promoOrder = await call(118, {items:[item(),item(accessory,1,'new_cylinder')], promoCode:' save '});
  assert.equal(promoOrder.items_subtotal,27.4);
  assert.equal(promoOrder.discount,2.74);
  assert.equal(promoOrder.total_amount,34.66);
  assert.deepEqual(await call(118, {items:[item(accessory,1,'new_cylinder'),item()], promoCode:'SAVE'}), promoOrder);
  const freeDelivery = await call(119,{address:highrise,promoCode:'SUBSIDY'});
  assert.equal(freeDelivery.delivery_fee,8);
  assert.equal(freeDelivery.discount,8);
  assert.equal(freeDelivery.total_amount,27.8);
  await auth(otherBuyer);
  await assert.rejects(() => call(101,{address:somebodyElseAddr}), {code:'23505'});

  await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT used_count FROM public.promotions WHERE code='LIMITED'")).rows[0].used_count,0);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM public.orders')).rows[0].n),3);
  await auth(buyer);
  await db.exec("SET test.admin = 'true'");
  const staffOrder = await call(120);
  assert.equal(staffOrder.delivery_fee, 5);
  assert.equal(staffOrder.total_amount, first.total_amount);
  await assert.rejects(() => call(121,{address:farAddr}), /di luar kawasan/);
  await checkAbsent(121);
  console.log('PASS: authenticated/anon grants, reuse and mismatch, canonical price/fees, all-or-nothing writes, ordered multi-line promo, owned addresses, delivery radius, merchant/category/availability, cylinder limits, company, wrong item type, malformed quantities');
  await db.close();
}
main().catch(error => {
  console.error(error?.message, error?.code, error?.where, error?.detail);
  process.exitCode = 1;
});

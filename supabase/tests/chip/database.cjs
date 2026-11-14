const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const uuid = (n) => `bda28d2d-0955-4f12-9ad6-${String(n).padStart(12, '0')}`;
const brand = uuid(90);
const schema = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function public.is_admin(uuid) returns boolean language sql stable as $$ select false $$;
  create type public.payment_status as enum ('pending','failed','paid','refunded','partial_refund');
  create type public.order_status as enum ('pending','accepted','cancelled','delivered');
  create type public.payment_method as enum ('fpx','card','ewallet','cod');
  create table public.orders (
    id uuid primary key, customer_id uuid, code text, total_amount numeric,
    status public.order_status not null default 'pending', payment_method public.payment_method not null default 'fpx',
    payment_status public.payment_status not null default 'pending',
    address_snapshot jsonb, merchant_id uuid, items_subtotal numeric, delivery_fee numeric,
    service_fee numeric, processing_fee numeric, discount numeric, gas_exchange_fee numeric,
    gas_exchange_type text, promotion_code text
  );
  create table public.payments (
    id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, gateway text,
    gateway_ref text, amount numeric, raw_payload jsonb, created_at timestamptz default clock_timestamp(),
    status public.payment_status not null default 'pending'
  );
  create table public.fund_movements (id uuid primary key, chip_purchase_id text, amount numeric, status text, direction text);
  create table public.order_items (order_id uuid references public.orders);
  create table public.paid_effects (order_id uuid);
  create function public.count_paid() returns trigger language plpgsql as $$ begin
    if new.payment_status = 'paid' and old.payment_status <> 'paid' then
      if new.id = 'bda28d2d-0955-4f12-9ad6-000000000066' then raise exception 'fixture update failure'; end if;
      insert into public.paid_effects values (new.id);
    end if;
    return new;
  end $$;
  create trigger count_paid after update on public.orders for each row execute function public.count_paid();
`;

function facts(ref, overrides = {}) {
  return { id: uuid(100 + ref), reference: uuid(ref), status: 'paid', brand_id: brand, is_test: false,
    marked_as_paid: false, purchase: { total: 2280, currency: 'MYR' }, ...overrides };
}

async function main() {
  const db = new PGlite();
  await db.exec(schema);
  await db.exec(fs.readFileSync(__dirname + '/../../migrations/20261115001900_reserve_chip_order_payment.sql', 'utf8'));
  const migration = __dirname + '/../../migrations/20261115002000_chip_collect_callback.sql';
  await db.exec(fs.readFileSync(migration, 'utf8'));
  await db.exec(fs.readFileSync(migration, 'utf8')); // repeats remain safe
  const apply = async (purchase, expectedBrand = brand, expectedTest = false) =>
    (await db.query(`select public.apply_chip_collect_notification($1,$2,$3) as value`, [purchase, expectedBrand, expectedTest])).rows[0].value.result;
  const paymentStatus = async (key) =>
    (await db.query(`select p.status as payment, o.payment_status as order, p.raw_payload from public.orders o join public.payments p on p.order_id=o.id where o.id=$1 and p.gateway_ref=$2`, [uuid(key), uuid(100 + key)])).rows[0];
  async function fixture(n, options = {}) {
    await db.query(`insert into public.orders (id,customer_id,code,total_amount,status,payment_method,payment_status) values ($1,$2,'fixture',$3,$4,$5,$6)`, [uuid(n), uuid(99), options.orderAmount ?? 22.80, options.orderStatus ?? 'pending', options.method ?? 'fpx', options.orderPayment ?? 'pending']);
    if (!options.noItems) await db.query(`insert into public.order_items values($1)`, [uuid(n)]);
    if (!options.unbound) await db.query(`insert into public.payments (id,order_id,gateway,gateway_ref,amount,raw_payload,status) values ($1,$2,'chip',$3,22.80,$4,$5)`, [uuid(200 + n), uuid(n), uuid(100 + n), options.raw ?? { brand_id: brand, is_test: !!options.test }, options.paymentStatus ?? 'pending']);
  }

  assert.deepEqual((await db.query(`select has_function_privilege('anon','public.apply_chip_collect_notification(jsonb,text,boolean)','EXECUTE') as anon,
    has_function_privilege('authenticated','public.apply_chip_collect_notification(jsonb,text,boolean)','EXECUTE') as authenticated,
    has_function_privilege('service_role','public.apply_chip_collect_notification(jsonb,text,boolean)','EXECUTE') as service`)).rows[0], {anon:false,authenticated:false,service:true});

  await fixture(1);
  assert.equal(await apply(facts(1)), 'applied');
  assert.equal(await apply(facts(1)), 'duplicate');
  assert.equal(await apply(facts(1, { status: 'expired' })), 'duplicate');
  assert.deepEqual(await paymentStatus(1), { payment: 'paid', order: 'paid', raw_payload: { brand_id: brand, is_test: false, _gasbee_callback_status: 'paid' } });
  assert.equal(Number((await db.query('select count(*) as n from public.paid_effects where order_id=$1', [uuid(1)])).rows[0].n), 1);

  await fixture(2);
  for (const overrides of [
    { purchase: { total: 2279, currency: 'MYR' } },
    { purchase: { total: 2280, currency: 'USD' } },
    { purchase: { currency: 'MYR' } },
    { purchase: { total: '2280', currency: 'MYR' } },
    { purchase: { total: 22.8, currency: 'MYR' } },
    { marked_as_paid: true }, { brand_id: uuid(91) }, { reference: uuid(1) }, { is_test: true },
    { purchase: { total: 2280, currency: 'MYR', metadata: { gasbee_payment_id: uuid(203) } } },
  ]) assert.equal(await apply(facts(2, overrides)), 'rejected');
  assert.equal((await paymentStatus(2)).order, 'pending');
  assert.equal(await apply(facts(2, { status: 'error' })), 'no_change');
  assert.equal(await apply(facts(2, { status: 'expired' })), 'applied');
  assert.equal((await paymentStatus(2)).order, 'failed');
  assert.equal((await paymentStatus(2)).raw_payload._gasbee_retired_status, 'expired');
  assert.equal(await apply(facts(2, { status: 'expired' })), 'duplicate');

  await fixture(3, { test: true });
  assert.equal(await apply(facts(3, { is_test: true }), brand, true), 'test_ignored');
  assert.equal((await paymentStatus(3)).order, 'pending');
  assert.equal(await apply(facts(4)), 'unknown_purchase');

  for (const [n, options] of [[5, { orderAmount: 25 }], [6, { orderStatus: 'cancelled' }], [7, { noItems: true }], [8, { method: 'cod' }]]) {
    await fixture(n, options);
    assert.equal(await apply(facts(n)), 'review');
    assert.equal(await apply(facts(n)), 'review');
    assert.equal((await paymentStatus(n)).order, 'pending');
    assert.equal((await paymentStatus(n)).raw_payload._gasbee_callback_review, true);
  }
  await fixture(9, { paymentStatus: 'paid' });
  assert.equal(await apply(facts(9, { status: 'cleared' })), 'applied');
  assert.equal((await paymentStatus(9)).order, 'paid');
  await fixture(10);
  await db.query(`insert into public.payments (order_id,gateway,gateway_ref,amount,status) values($1,'chip',$2,22.80,'pending')`, [uuid(10), uuid(999)]);
  assert.equal(await apply(facts(10, { status: 'cancelled' })), 'applied');
  assert.equal((await paymentStatus(10)).order, 'pending');

  await fixture(11, { unbound: true });
  const reserved = (await db.query(`select public.begin_chip_order_payment($1,$2) as attempt`, [uuid(11), uuid(99)])).rows[0].attempt;
  const receipt = facts(11, { purchase: { total: 2280, currency: 'MYR', metadata: { gasbee_payment_id: reserved.payment_id } } });
  assert.equal(await apply({ ...receipt, purchase: { total: 2280, currency: 'MYR' } }), 'unknown_purchase');
  assert.equal(await apply(receipt), 'applied');
  assert.equal(await apply(receipt), 'duplicate');
  await db.query('select public.finish_chip_order_payment($1,$2,$3)', [reserved.payment_id, receipt.id, receipt]);
  assert.equal(await apply({ ...receipt, purchase: { total: 2280, currency: 'MYR' } }), 'rejected');
  assert.equal((await paymentStatus(11)).raw_payload._gasbee_reservation, true);

  await db.query(`insert into public.fund_movements values ($1,$2,22.80,'pending','bank_to_chip')`, [uuid(12), uuid(112)]);
  assert.equal(await apply(facts(12, { reference: `topup:${uuid(12)}` }), uuid(91)), 'rejected');
  assert.equal(await apply(facts(12, { reference: `topup:${uuid(12)}`, is_test:true }), brand, true), 'test_ignored');
  assert.equal(await apply(facts(12, { reference: `topup:${uuid(12)}` })), 'applied');
  assert.equal(await apply(facts(12, { reference: `topup:${uuid(12)}` })), 'duplicate');
  assert.equal((await db.query('select status from public.fund_movements where id=$1', [uuid(12)])).rows[0].status,'paid');

  await fixture(66);
  await assert.rejects(() => apply(facts(66)), /fixture update failure/);
  assert.equal((await paymentStatus(66)).payment, 'pending');
  assert.equal((await paymentStatus(66)).order, 'pending');
  await db.close();
  console.log('Passed CHIP SQL compile/ACL, repeat migration, signed-fact expectations, duplicate/late handling, start/finalize contract, top-up, and atomic rollback checks.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

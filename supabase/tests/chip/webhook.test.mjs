import assert from 'node:assert/strict';
import test from 'node:test';
import { createChipWebhook } from '../../functions/chip-webhook/handler.ts';

const id = '2b6137fb-4ae9-4e4a-b92f-337a917dfdcf';
const order = '4868ab01-7210-4478-a4bf-28adc3705880';
const brand = '70a80eae-8a22-4a65-8f4f-63a0afd1cae3';
const paymentId = 'd5bc4012-28d2-4c99-9e7b-5d0517ff6126';
const baseline = { type: 'purchase', id, reference: order, status: 'paid', brand_id: brand, is_test: false, marked_as_paid: false, purchase: { total: 2280, currency: 'MYR', metadata: { gasbee_payment_id: paymentId } }, client: { email: 'example@example.test' } };
const event = JSON.stringify({ type: 'purchase', id, status: 'created' });
const generator = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const keys = await generator();
const secondary = await generator();
async function pemFor(publicKey) {
  const der = await crypto.subtle.exportKey('spki', publicKey);
  return `-----BEGIN PUBLIC KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PUBLIC KEY-----`;
}
const companyPem = await pemFor(keys.publicKey);
const secondaryPem = await pemFor(secondary.publicKey);
async function signature(body, key = keys.privateKey) {
  return Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))).toString('base64');
}
function req(body, sig) {
  return new Request('https://example.test/functions/v1/chip-webhook', { method: 'POST', headers: sig === undefined ? {} : { 'X-Signature': sig }, body });
}
function setup({ purchase = baseline, result = 'applied', registerKeys = [], gatewayFailure, databaseFailure } = {}) {
  const fetched = [];
  const finalized = [];
  const logged = [];
  const handler = createChipWebhook({
    gatewayConfig: async () => ({ apiKey: 'mock', brandId: brand, isTest: false, registeredWebhookKeys: registerKeys }),
    fetcher: async (url, options) => {
      assert.equal(url.origin, 'https://gate.chip-in.asia');
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, 'Bearer mock');
      fetched.push(url.pathname);
      if (url.pathname === '/api/v1/public_key/') return Response.json(companyPem);
      assert.equal(url.pathname, `/api/v1/purchases/${id}/`);
      if (gatewayFailure) return new Response('', { status: 502 });
      return Response.json(purchase);
    },
    finalize: async (facts) => {
      if (databaseFailure) throw new Error('test database unavailable');
      finalized.push(facts);
      return result;
    },
    log: (code) => logged.push(code),
  });
  return { handler, fetched, finalized, logged };
}

test('a signed callback fetches authoritative state, caches public key, and passes only payment facts', async () => {
  const app = setup();
  const sig = await signature(event);
  assert.equal((await app.handler(req(event, sig))).status, 204);
  assert.equal((await app.handler(req(event, sig))).status, 204);
  assert.deepEqual(app.fetched, ['/api/v1/public_key/', `/api/v1/purchases/${id}/`, `/api/v1/purchases/${id}/`]);
  assert.equal(app.finalized[0].status, 'paid');
  assert.equal(app.finalized[0].client, undefined);
});

test('derives the callback-first source from the verified purchase instead of the callback event', async () => {
  const body = JSON.stringify({
    type: 'purchase', id, _gasbee_checkout_source: 'app',
    success_redirect: `https://gasbee.com.my/payment-bridge?status=success&order_id=${order}`,
    failure_redirect: `https://gasbee.com.my/payment-bridge?status=failed&order_id=${order}`,
  });
  const sig = await signature(body);
  const app = setup({ purchase: {
    ...baseline,
    success_redirect: `https://gasbee.com.my/order/orders/${order}?payment=success`,
    failure_redirect: `https://gasbee.com.my/order/orders/${order}?payment=failed`,
  } });
  assert.equal((await app.handler(req(body, sig))).status, 204);
  assert.equal(app.finalized[0]._gasbee_checkout_source, 'web');

  const ambiguous = setup({ purchase: {
    ...baseline, _gasbee_checkout_source: 'web',
    success_redirect: `https://untrusted.example/order/orders/${order}?payment=success`,
    failure_redirect: `https://gasbee.com.my/order/orders/${order}?payment=failed`,
  } });
  assert.equal((await ambiguous.handler(req(body, sig))).status, 204);
  assert.equal(ambiguous.finalized[0]._gasbee_checkout_source, undefined);
});

test('missing, malformed and tampered signatures stop before purchase lookup or database writes', async () => {
  const app = setup();
  assert.equal((await app.handler(req(event))).status, 401);
  assert.equal((await app.handler(req(event, 'bad'))).status, 401);
  assert.deepEqual(app.fetched, []);
  assert.equal((await app.handler(req(event + ' ', await signature(event)))).status, 401);
  assert.deepEqual(app.fetched, ['/api/v1/public_key/']);
  assert.deepEqual(app.finalized, []);
});

test('registered webhook key works and non-purchase events cannot change a payment', async () => {
  const app = setup({ registerKeys: [secondaryPem] });
  assert.equal((await app.handler(req(event, await signature(event, secondary.privateKey)))).status, 204);
  const refund = JSON.stringify({ type: 'payment', id });
  assert.equal((await app.handler(req(refund, await signature(refund, secondary.privateKey)))).status, 204);
  assert.deepEqual(app.fetched, [`/api/v1/purchases/${id}/`]);
  assert.equal(app.finalized.length, 1);
});

test('rejects wrong purchase identifiers, missing amount and mode, invalid currency and manual paid flags', async () => {
  const sig = await signature(event);
  for (const purchase of [
    { ...baseline, id: order },
    { ...baseline, purchase: { currency: 'MYR', total: null } },
    { ...baseline, purchase: { currency: 'MYR', total: 1.2 } },
    { ...baseline, purchase: { currency: 'USD', total: 2280 } },
    { ...baseline, is_test: undefined },
    { ...baseline, reference: 'unexpected' },
    { ...baseline, brand_id: '' },
    { ...baseline, marked_as_paid: true },
  ]) {
    const app = setup({ purchase });
    assert.equal((await app.handler(req(event, sig))).status, 422);
    assert.deepEqual(app.finalized, []);
  }
});

test('handles topup and database outcomes, including retry for callback before persistence', async () => {
  const sig = await signature(event);
  for (const [result, status] of [['applied', 204], ['duplicate', 204], ['test_ignored', 204], ['review', 204], ['unknown_purchase', 503], ['rejected', 422]]) {
    const app = setup({ purchase: { ...baseline, reference: `topup:${order}` }, result });
    assert.equal((await app.handler(req(event, sig))).status, status);
    assert.equal(app.finalized[0].reference, `topup:${order}`);
  }
  assert.equal((await setup({ gatewayFailure: true }).handler(req(event, sig))).status, 503);
  assert.equal((await setup({ databaseFailure: true }).handler(req(event, sig))).status, 503);
});

test('method and body-size checks prevent unbounded callback work', async () => {
  const app = setup();
  assert.equal((await app.handler(new Request('https://example.test/'))).status, 405);
  const large = 'x'.repeat(128 * 1024 + 1);
  assert.equal((await app.handler(req(large, await signature(large)))).status, 413);
  assert.deepEqual(app.fetched, []);
});

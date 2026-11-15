import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChipPurchase, PurchaseRequestError } from '../../functions/chip-create-purchase/handler.ts';

const orderId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const paymentId = '10000000-0000-4000-8000-000000000003';
const remoteId = '10000000-0000-4000-8000-000000000004';
const brandId = '10000000-0000-4000-8000-000000000005';
const checkout = `https://gate.chip-in.asia/p/${remoteId}/`;
const config = { apiKey: 'fake-not-a-key', brandId, isTest: false };

function request(body: Record<string, unknown> = {}, authorization = 'Bearer test-session') {
  return new Request('https://synthetic.local/chip-create-purchase', {
    method: 'POST', headers: { Authorization: authorization },
    body: JSON.stringify({ order_id: orderId, ...body }),
  });
}

function fixture(status = 'created', changes: Record<string, unknown> = {}) {
  return {
    type: 'purchase', id: remoteId, reference: orderId, status, brand_id: brandId,
    is_test: false, marked_as_paid: false, checkout_url: checkout,
    purchase: { currency: 'MYR', total: 2500, metadata: { gasbee_payment_id: paymentId } },
    ...changes,
  };
}

function setup(overrides: Partial<Parameters<typeof createChipPurchase>[0]> = {}) {
  let claim: object | undefined;
  let attempt = paymentId;
  let posts = 0;
  const submitted: Array<{ success_redirect?: string; failure_redirect?: string; key: string | null }> = [];
  let providerStatus = 'created';
  let finalizeCount = 0;
  const handler = createChipPurchase({
    authenticate: async () => ({ id: userId, email: 'local@example.test', name: 'Test Customer' }),
    gatewayConfig: async () => config,
    begin: async (requestedOrder, requestedUser) => {
      assert.equal(requestedOrder, orderId);
      assert.equal(requestedUser, userId);
      if (claim) return claim;
      claim = { state: 'awaiting_gateway', payment_id: attempt, amount: 25 };
      return { state: 'reserved', payment_id: attempt, amount: 25, order_code: 'GB-TEST' };
    },
    finish: async (id, ref, payload) => {
      assert.equal(id, attempt);
      assert.equal(ref, remoteId);
      assert.equal(payload.checkout_url, checkout);
      claim = { state: 'check_gateway', payment_id: attempt, gateway_ref: remoteId, amount: 25 };
    },
    retire: async (id, ref, status) => {
      assert.equal(id, attempt);
      assert.equal(ref, remoteId);
      assert.ok(['cancelled', 'expired'].includes(status));
      claim = undefined;
      attempt = '10000000-0000-4000-8000-000000000006';
      providerStatus = 'created';
    },
    finalize: async () => { finalizeCount++; },
    callbackUrl: 'https://synthetic.local/functions/v1/chip-webhook',
    returnOrigins: ['https://mobile-gasbee.example.test'],
    fetcher: async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://gate.chip-in.asia');
      if (options?.method === 'POST') {
        posts++;
        const body = JSON.parse(String(options.body));
        assert.equal(body.purchase.products[0].price, 2500);
        assert.equal(body.purchase.metadata.gasbee_payment_id, attempt);
        const key = new Headers(options.headers).get('Idempotency-Key');
        assert.equal(key, attempt);
        submitted.push({ success_redirect: body.success_redirect, failure_redirect: body.failure_redirect, key });
      }
      return Response.json(fixture(providerStatus, {
        purchase: { currency: 'MYR', total: 2500, metadata: { gasbee_payment_id: attempt } },
      }));
    },
    ...overrides,
  });
  return { handler, posts: () => posts, submitted, setStatus: (value: string) => { providerStatus = value; }, finalizeCount: () => finalizeCount };
}

test('creates once, retrieves verified purchase on retry, and keeps supported native return URL', async () => {
  const { handler, posts } = setup();
  const req = {
    success_redirect: `https://gasbee.com.my/payment-bridge?status=success&order_id=${orderId}`,
    failure_redirect: `https://gasbee.com.my/payment-bridge?status=failed&order_id=${orderId}`,
  };
  const first = await handler(request(req));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { url: checkout, purchase_id: remoteId });
  assert.equal((await handler(request(req))).status, 200);
  assert.equal(posts(), 1);
});

test('rejects unsigned session and unsafe, cross-order, mismatched return URLs before reservation', async () => {
  const { handler, posts } = setup();
  assert.equal((await handler(request({}, 'invalid'))).status, 401);
  assert.equal((await handler(request({ success_redirect: `https://evil.example/order/orders/${orderId}?payment=success` }))).status, 400);
  assert.equal((await handler(request({ success_redirect: `https://app.gasbee.com.my/user/orders/${userId}?payment=success` }))).status, 400);
  assert.equal((await handler(request({ success_redirect: `https://gasbee.com.my/payment-bridge?status=failed&order_id=${orderId}` }))).status, 400);
  assert.equal(posts(), 0);
});

test('blocks repeated POST after ambiguous provider timeout', async () => {
  let posts = 0;
  const { handler } = setup({
    fetcher: async (_url, opts) => {
      if (opts?.method === 'POST') posts++;
      throw new Error('mock timeout without outside call');
    },
  });
  assert.equal((await handler(request())).status, 503);
  assert.equal((await handler(request())).status, 409);
  assert.equal(posts, 1);
});

test('prevents concurrent provider POSTs while a reservation is in progress', async () => {
  let resolveGateway!: (res: Response) => void;
  let notifyPosted!: () => void;
  const posted = new Promise<void>(resolve => { notifyPosted = resolve; });
  const gateway = new Promise<Response>(resolve => { resolveGateway = resolve; });
  let posts = 0;
  const { handler } = setup({
    fetcher: async (_url, opts) => {
      assert.equal(opts?.method, 'POST');
      posts++;
      notifyPosted();
      return gateway;
    },
  });
  const first = handler(request());
  await posted;
  assert.equal((await handler(request())).status, 409);
  resolveGateway(Response.json(fixture()));
  assert.equal((await first).status, 200);
  assert.equal(posts, 1);
});

test('only verified closed status permits fresh payment', async () => {
  const { handler, posts, setStatus, submitted } = setup();
  assert.equal((await handler(request())).status, 200);
  setStatus('error');
  assert.equal((await handler(request())).status, 200);
  assert.equal(posts(), 1);
  setStatus('expired');
  assert.equal((await handler(request())).status, 200);
  assert.equal(posts(), 2);
  assert.equal(new Set(submitted.map(({ key }) => key)).size, 2);
});

test('charged payment reconciles with no replacement charge', async () => {
  const { handler, posts, setStatus, finalizeCount } = setup();
  assert.equal((await handler(request())).status, 200);
  setStatus('paid');
  assert.equal((await handler(request())).status, 409);
  assert.equal(finalizeCount(), 1);
  assert.equal(posts(), 1);
});

test('bad amount, wrong environment, different reference, and forged checkout are denied', async () => {
  const fixtures = [
    {purchase: {currency: 'USD', total: 2500}},
    {purchase: {currency: 'MYR', total: 2501, metadata:{gasbee_payment_id:paymentId}}},
    {is_test: true},
    {reference: userId},
    {checkout_url: `https://evil.example/p/${remoteId}/`},
  ];
  for (const changes of fixtures) {
    const { handler } = setup({fetcher: async () => Response.json(fixture('created', changes))});
    assert.notEqual((await handler(request())).status, 200);
  }
});

test('configured origin supports existing Native app redirects and V2 browser hosts', async () => {
  const { handler } = setup();
  assert.equal((await handler(request({
    success_redirect: `https://mobile-gasbee.example.test/user/orders/${orderId}?payment=success`,
    failure_redirect: `https://mobile-gasbee.example.test/user/orders/${orderId}?payment=failed`,
  }))).status, 200);
});

test('uses safe refusal for an order owned by another user or otherwise unavailable', async () => {
  const { handler, posts } = setup({begin: async () => { throw new PurchaseRequestError(404, 'Order not found'); }});
  assert.equal((await handler(request())).status, 404);
  assert.equal(posts(), 0);
});

test('sends the exact same-order portal return URLs for both production hosts', async () => {
  for (const origin of ['https://gasbee.com.my', 'https://www.gasbee.com.my']) {
    const { handler, posts, submitted } = setup();
    const redirects = {
      success_redirect: `${origin}/order/orders/${orderId}?payment=success`,
      failure_redirect: `${origin}/order/orders/${orderId}?payment=failed`,
    };
    const response = await handler(request(redirects));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: checkout, purchase_id: remoteId });
    assert.deepEqual(submitted, [{ ...redirects, key: paymentId }]);
    assert.equal((await handler(request(redirects))).status, 200);
    assert.equal(posts(), 1);
  }
});

test('rejects portal returns for another order or unexpected query values', async () => {
  const { handler, posts } = setup();
  for (const success_redirect of [
    `https://gasbee.com.my/order/orders/${userId}?payment=success`,
    `https://gasbee.com.my/order/orders/${orderId}?payment=failed`,
    `https://gasbee.com.my/order/orders/${orderId}?payment=success&untrusted=1`,
  ]) {
    assert.equal((await handler(request({ success_redirect }))).status, 400);
  }
  assert.equal(posts(), 0);
});

test('allows verified V2 browser origins', async () => {
  const { handler, posts } = setup();
  for (const origin of ['https://app.gasbee.com.my', 'https://gasbee.lovable.app']) {
    assert.equal((await handler(request({ success_redirect: `${origin}/user/orders/${orderId}?payment=success` }))).status, 200);
  }
  assert.equal(posts(), 1);
});

test('requires reconciliation for multiple legacy attempts before provider access', async () => {
  const { handler, posts } = setup({begin: async () => ({state:'requires_review'})});
  const response = await handler(request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /existing payment attempts/);
  assert.equal(posts(), 0);
});

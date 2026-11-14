const CHIP_BASE = 'https://gate.chip-in.asia/api/v1/';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PAYABLE = new Set(['created', 'sent', 'viewed', 'overdue', 'error', 'blocked']);
const CHARGED = new Set(['paid', 'cleared', 'settled']);
const TERMINAL = new Set(['cancelled', 'expired']);
const CHECKOUT_ORIGINS = new Set(['https://gate.chip-in.asia', 'https://payments.chip-in.asia']);
const PORTAL_ORIGINS = new Set(['https://gasbee.com.my', 'https://www.gasbee.com.my']);
const V2_ORIGINS = [
  'https://app.gasbee.com.my',
  'https://gasbee.lovable.app',
  'https://id-preview--0c2049ef-a851-486b-94a3-95a84d60c4ba.lovable.app',
];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};

type User = { id: string; email?: string; name?: string; phone?: string };
type Config = { apiKey: string; brandId: string; isTest: boolean };
type Reservation = {
  state: 'reserved' | 'awaiting_gateway' | 'check_gateway';
  payment_id: string;
  gateway_ref?: string;
  amount: number;
  order_code?: string;
};
type Purchase = {
  id: string;
  type: 'purchase';
  reference: string;
  brand_id: string;
  is_test: boolean;
  status: string;
  marked_as_paid: boolean;
  purchase: { currency: 'MYR'; total: number; metadata?: { gasbee_payment_id?: string } };
  checkout_url?: string;
};
type Dependencies = {
  authenticate: (authorization: string) => Promise<User | null>;
  gatewayConfig: () => Promise<Config>;
  begin: (orderId: string, customerId: string) => Promise<unknown>;
  finish: (paymentId: string, gatewayRef: string, payload: Purchase) => Promise<void>;
  retire: (paymentId: string, gatewayRef: string, status: string) => Promise<void>;
  finalize: (payload: Purchase, config: Config) => Promise<void>;
  callbackUrl: string;
  returnOrigins?: string[];
  fetcher?: typeof fetch;
  log?: (code: string) => void;
};

export class PurchaseRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function json(status: number, payload: unknown): Response {
  return Response.json(payload, { status, headers: cors });
}

function waiting(message = 'Payment is being checked. Please return to your order before trying again.') {
  return new PurchaseRequestError(409, message);
}

function knownReturnOrigins(extra: string[]) {
  const origins = new Set([...PORTAL_ORIGINS, ...V2_ORIGINS]);
  for (const origin of extra) {
    try {
      const parsed = new URL(origin.trim());
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) origins.add(parsed.origin);
    } catch {
      // A malformed origin never grants redirect permission.
    }
  }
  return origins;
}

function returnUrl(raw: unknown, orderId: string, outcome: 'success' | 'failed', origins: Set<string>): string | undefined {
  // The existing gateway omits the return URL when neither caller nor configuration provides one.
  if (raw === undefined || raw === null || raw === '') return;
  try {
    if (typeof raw !== 'string' || raw.length > 1000) throw new Error();
    const url = new URL(raw);
    if (!origins.has(url.origin) || url.username || url.password || url.hash) throw new Error();
    if (PORTAL_ORIGINS.has(url.origin) && url.pathname.startsWith('/order/orders/')) {
      throw new PurchaseRequestError(503, 'Website payments are temporarily paused. Your order has not been charged.');
    }
    if (
      (url.pathname === `/user/orders/${orderId}` || url.pathname === `/order/orders/${orderId}`) &&
      url.search === `?payment=${outcome}`
    ) return url.href;
    if (
      url.pathname === '/payment-bridge' &&
      url.searchParams.get('status') === outcome &&
      url.searchParams.get('order_id') === orderId &&
      [...url.searchParams].length === 2
    ) return url.href;
  } catch (error) {
    if (error instanceof PurchaseRequestError) throw error;
    // Use the same error for malformed, unrelated, and untrusted destinations.
  }
  throw new PurchaseRequestError(400, 'Invalid payment return page');
}

function reservationOf(value: unknown): Reservation {
  const row = record(value);
  const amount = Number(row?.amount);
  if (!row || typeof row.payment_id !== 'string' || !UUID.test(row.payment_id) ||
      !Number.isSafeInteger(Math.round(amount * 100)) || amount <= 0) throw new Error('invalid_reservation');
  const { state, gateway_ref, order_code } = row;
  if (state !== 'check_gateway' && state !== 'awaiting_gateway' && state !== 'reserved') throw new Error('invalid_reservation');
  if (state === 'check_gateway' && (typeof gateway_ref !== 'string' || !UUID.test(gateway_ref))) throw new Error('invalid_gateway_ref');
  return {
    state,
    payment_id: row.payment_id,
    amount,
    ...(typeof gateway_ref === 'string' ? { gateway_ref } : {}),
    ...(typeof order_code === 'string' ? { order_code } : {}),
  };
}

function safeCheckout(raw: unknown, id: string): string | undefined {
  if (typeof raw !== 'string') return;
  try {
    const url = new URL(raw);
    if (CHECKOUT_ORIGINS.has(url.origin) && !url.username && !url.password && new RegExp(`^/p/${id}/?$`, 'i').test(url.pathname)) {
      return url.href;
    }
  } catch {
    // Only a verified CHIP checkout link may go to a customer.
  }
}

function purchaseOf(value: unknown, orderId: string, claim: Reservation, config: Config): Purchase {
  const remote = record(value);
  const data = record(remote?.purchase);
  const metadata = record(data?.metadata);
  if (!remote || !data || remote.type !== 'purchase' ||
      typeof remote.id !== 'string' || !UUID.test(remote.id) ||
      (claim.gateway_ref && remote.id !== claim.gateway_ref) ||
      remote.reference !== orderId || remote.brand_id !== config.brandId || remote.is_test !== config.isTest ||
      typeof remote.status !== 'string' || typeof remote.marked_as_paid !== 'boolean' ||
      data.currency !== 'MYR' || data.total !== Math.round(claim.amount * 100) ||
      (metadata?.gasbee_payment_id !== undefined && metadata.gasbee_payment_id !== claim.payment_id) ||
      (claim.state === 'reserved' && metadata?.gasbee_payment_id !== claim.payment_id)) {
    throw new Error('purchase_details_mismatch');
  }
  const checkout = safeCheckout(remote.checkout_url, remote.id);
  return {
    id: remote.id, type: 'purchase', reference: orderId, brand_id: config.brandId,
    is_test: config.isTest, status: remote.status, marked_as_paid: remote.marked_as_paid,
    purchase: {
      currency: 'MYR', total: Math.round(claim.amount * 100),
      ...(metadata?.gasbee_payment_id === claim.payment_id ? { metadata: { gasbee_payment_id: claim.payment_id } } : {}),
    },
    ...(checkout ? { checkout_url: checkout } : {}),
  };
}

export function createChipPurchase(deps: Dependencies): (req: Request) => Promise<Response> {
  const fetcher = deps.fetcher ?? fetch;
  const origins = knownReturnOrigins(deps.returnOrigins ?? []);
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (Number(req.headers.get('content-length')) > 8192) return json(413, { error: 'Request too large' });

    try {
      const auth = req.headers.get('Authorization') ?? '';
      if (!/^Bearer +\S+$/i.test(auth)) throw new PurchaseRequestError(401, 'Please sign in to pay');
      const user = await deps.authenticate(auth);
      if (!user) throw new PurchaseRequestError(401, 'Please sign in to pay');

      let request: Record<string, unknown> | undefined;
      try {
        const body = await req.text();
        if (body.length > 8192) throw new PurchaseRequestError(413, 'Request too large');
        request = record(JSON.parse(body));
      } catch (e) {
        if (e instanceof PurchaseRequestError) throw e;
        throw new PurchaseRequestError(400, 'Invalid payment request');
      }

      const orderId = request?.order_id;
      if (typeof orderId !== 'string' || !UUID.test(orderId)) throw new PurchaseRequestError(400, 'Invalid order');
      const success = returnUrl(request?.success_redirect, orderId, 'success', origins);
      const failure = returnUrl(request?.failure_redirect, orderId, 'failed', origins);
      const config = await deps.gatewayConfig();
      const apiHeaders = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };

      // There may be more than one historical attempt from before this change.
      // A positive cancellation/expiry can retire one. Network uncertainty cannot.
      for (let check = 0; check < 4; check++) {
        const result = await deps.begin(orderId, user.id);
        if (record(result)?.state === 'requires_review') {
          throw waiting('There are existing payment attempts for this order. Please contact Gasbee support before paying.');
        }
        const claim = reservationOf(result);
        if (claim.state === 'awaiting_gateway') throw waiting();

        if (claim.state === 'check_gateway') {
          const remote = await fetcher(new URL(`purchases/${claim.gateway_ref}/`, CHIP_BASE), {
            headers: apiHeaders, redirect: 'error', signal: AbortSignal.timeout(7000),
          });
          if (!remote.ok) throw waiting();
          const purchase = purchaseOf(await remote.json(), orderId, claim, config);
          if (CHARGED.has(purchase.status)) {
            if (!purchase.marked_as_paid) await deps.finalize(purchase, config);
            throw waiting('This payment has already been processed. Please check your order status.');
          }
          if (TERMINAL.has(purchase.status) && !purchase.marked_as_paid) {
            await deps.retire(claim.payment_id, purchase.id, purchase.status);
            continue;
          }
          if (PAYABLE.has(purchase.status) && !purchase.marked_as_paid && purchase.checkout_url) {
            return json(200, { url: purchase.checkout_url, purchase_id: purchase.id });
          }
          throw waiting();
        }

        const remote = await fetcher(new URL('purchases/', CHIP_BASE), {
          method: 'POST', headers: apiHeaders, redirect: 'error', signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            brand_id: config.brandId,
            success_callback: deps.callbackUrl,
            success_redirect: success,
            failure_redirect: failure,
            reference: orderId,
            purchase: {
              currency: 'MYR',
              metadata: { gasbee_payment_id: claim.payment_id },
              products: [{ name: `Order ${claim.order_code ?? orderId}`, price: Math.round(claim.amount * 100), quantity: 1 }],
            },
            client: {
              email: user.email || 'noreply@gasbee.app',
              full_name: user.name || user.email || 'Customer',
              ...(user.phone ? { phone: user.phone } : {}),
            },
          }),
        });
        if (!remote.ok) {
          // Even on provider failure, never discard the reservation automatically.
          deps.log?.('create_result_requires_reconciliation');
          throw waiting();
        }
        const purchase = purchaseOf(await remote.json(), orderId, claim, config);
        await deps.finish(claim.payment_id, purchase.id, purchase);
        if (PAYABLE.has(purchase.status) && !purchase.marked_as_paid && purchase.checkout_url) {
          return json(200, { url: purchase.checkout_url, purchase_id: purchase.id });
        }
        throw waiting();
      }
      throw waiting();
    } catch (e) {
      if (e instanceof PurchaseRequestError) return json(e.status, { error: e.message });
      deps.log?.('chip_payment_init_requires_review');
      return json(503, { error: 'Payment status is being checked. Please do not make another payment.' });
    }
  };
}

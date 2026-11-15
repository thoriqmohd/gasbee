import { inferGasbeePaymentSource, type GasbeePaymentSource } from '../_shared/gasbee-payment-source.ts';

const CHIP_BASE = 'https://gate.chip-in.asia/api/v1/';
const MAX_CALLBACK_BYTES = 128 * 1024;
const CHARGED_STATUSES = new Set(['paid', 'cleared', 'settled']);
const CLOSED_STATUSES = new Set(['cancelled', 'expired']);
const KNOWN_STATUSES = new Set([
  ...CHARGED_STATUSES, ...CLOSED_STATUSES,
  'created', 'sent', 'viewed', 'error', 'overdue', 'blocked', 'hold',
  'released', 'pending_release', 'pending_capture', 'preauthorized',
  'pending_execute', 'pending_charge', 'chargeback', 'pending_refund', 'refunded',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Purchase = {
  id: string;
  reference: string;
  status: string;
  brand_id: string;
  is_test: boolean;
  marked_as_paid: boolean;
  purchase: { total: number; currency: 'MYR'; metadata?: { gasbee_payment_id: string } };
  _gasbee_checkout_source?: GasbeePaymentSource;
};

export type GatewayConfig = {
  apiKey: string;
  brandId: string;
  isTest: boolean | null;
  registeredWebhookKeys: string[];
};

export type Finalization = 'applied' | 'duplicate' | 'no_change' | 'test_ignored' | 'review' | 'unknown_purchase' | 'rejected';

type Dependencies = {
  gatewayConfig: () => Promise<GatewayConfig>;
  finalize: (purchase: Purchase, config: GatewayConfig) => Promise<Finalization>;
  fetcher?: typeof fetch;
  log?: (code: string) => void;
};

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(request.headers.get('content-length')) > MAX_CALLBACK_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CALLBACK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function importKey(pem: string): Promise<CryptoKey> {
  if (!pem.trimStart().startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error('invalid_pem');
  const der = fromBase64(pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, ''));
  return crypto.subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function purchaseFacts(value: unknown, requestedId: string): Purchase | null {
  const remote = object(value);
  const purchase = object(remote?.purchase);
  if (!remote || !purchase || remote.type !== 'purchase' || remote.id !== requestedId) return null;
  const { reference, status, brand_id, is_test, marked_as_paid } = remote;
  if (typeof reference !== 'string' || !UUID.test(reference.replace(/^topup:/, ''))) return null;
  if (typeof status !== 'string' || !KNOWN_STATUSES.has(status)) return null;
  if (typeof brand_id !== 'string' || !UUID.test(brand_id) || typeof is_test !== 'boolean' || typeof marked_as_paid !== 'boolean') return null;
  if (typeof purchase.total !== 'number' || !Number.isSafeInteger(purchase.total) || purchase.total <= 0 || purchase.currency !== 'MYR') return null;
  const metadata = object(purchase.metadata);
  const paymentId = metadata?.gasbee_payment_id;
  if (paymentId !== undefined && (typeof paymentId !== 'string' || !UUID.test(paymentId))) return null;
  const source = inferGasbeePaymentSource(reference, remote.success_redirect, remote.failure_redirect);
  return {
    id: requestedId, reference, status, brand_id, is_test, marked_as_paid,
    ...(source ? { _gasbee_checkout_source: source } : {}),
    purchase: {
      total: purchase.total,
      currency: 'MYR',
      ...(typeof paymentId === 'string' ? { metadata: { gasbee_payment_id: paymentId } } : {}),
    },
  };
}

export function createChipWebhook(deps: Dependencies): (req: Request) => Promise<Response> {
  const fetcher = deps.fetcher ?? fetch;
  let cached: { apiKey: string; until: number; publicKey: Promise<CryptoKey> } | undefined;

  async function gatewayGet(path: string, apiKey: string): Promise<unknown> {
    const remote = await fetcher(new URL(path, CHIP_BASE), {
      method: 'GET', headers: { Authorization: `Bearer ${apiKey}` },
      redirect: 'error', signal: AbortSignal.timeout(6000),
    });
    if (!remote.ok) throw new Error('provider_read_failed');
    return remote.json();
  }

  function companyKey(apiKey: string): Promise<CryptoKey> {
    if (cached?.apiKey === apiKey && cached.until > Date.now()) return cached.publicKey;
    const publicKey = gatewayGet('public_key/', apiKey).then((value) => {
      if (typeof value !== 'string') throw new Error('provider_key_format');
      return importKey(value);
    }).catch((error) => {
      if (cached?.publicKey === publicKey) cached = undefined;
      throw error;
    });
    cached = { apiKey, until: Date.now() + 5 * 60 * 1000, publicKey };
    return publicKey;
  }

  async function verifies(config: GatewayConfig, signature: Uint8Array<ArrayBuffer>, body: Uint8Array<ArrayBuffer>): Promise<boolean> {
    for (const pem of config.registeredWebhookKeys) {
      const key = await importKey(pem);
      if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, body)) return true;
    }
    const key = await companyKey(config.apiKey);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, body);
  }

  return async (request) => {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    const rawSignature = request.headers.get('X-Signature');
    if (!rawSignature || !/^[a-z0-9+/]{128,1024}={0,2}$/i.test(rawSignature)) return new Response('Invalid signature', { status: 401 });
    let signature: Uint8Array<ArrayBuffer>;
    try { signature = fromBase64(rawSignature); } catch { return new Response('Invalid signature', { status: 401 }); }

    try {
      const body = await boundedBody(request);
      if (!body) return new Response('Payload too large', { status: 413 });
      const config = await deps.gatewayConfig();
      if (!await verifies(config, signature, body)) return new Response('Invalid signature', { status: 401 });

      let event: Record<string, unknown> | undefined;
      try { event = object(JSON.parse(new TextDecoder().decode(body))); } catch { return new Response('Invalid event', { status: 400 }); }
      // Registered payment/refund events also refer to a Purchase. Do not act on a
      // non-Purchase object; refund and dispute handling is a separate workflow.
      if (event?.type && event.type !== 'purchase') return new Response(null, { status: 204 });
      const id = event?.id;
      if (typeof id !== 'string' || !UUID.test(id)) return new Response('Invalid purchase', { status: 400 });
      const purchase = purchaseFacts(await gatewayGet(`purchases/${id}/`, config.apiKey), id);
      if (!purchase || (CHARGED_STATUSES.has(purchase.status) && purchase.marked_as_paid)) {
        deps.log?.('purchase_details_rejected');
        return new Response('Purchase details rejected', { status: 422 });
      }
      const result = await deps.finalize(purchase, config);
      if (result === 'unknown_purchase') return new Response('Purchase not recorded', { status: 503 });
      if (result === 'rejected') {
        deps.log?.('purchase_expectation_mismatch');
        return new Response('Purchase details rejected', { status: 422 });
      }
      if (result === 'review') deps.log?.('reconciliation_required');
      return new Response(null, { status: 204 });
    } catch {
      deps.log?.('callback_retry_required');
      return new Response('Callback processing unavailable', { status: 503 });
    }
  };
}

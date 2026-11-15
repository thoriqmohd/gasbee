export const PORTAL_ORIGINS = new Set(['https://gasbee.com.my', 'https://www.gasbee.com.my']);
export const V2_ORIGINS = [
  'https://app.gasbee.com.my',
  'https://gasbee.lovable.app',
  'https://id-preview--0c2049ef-a851-486b-94a3-95a84d60c4ba.lovable.app',
];

const LEGACY_VERCEL_ORIGIN = 'https://gasbee.vercel.app';
const LEGACY_APP_ORIGINS = new Set([
  LEGACY_VERCEL_ORIGIN,
  'https://0c2049ef-a851-486b-94a3-95a84d60c4ba.lovableproject.com',
  'https://localhost',
  'http://localhost:8080',
]);
const LEGACY_WEBSITE_ORIGINS = new Set([
  'https://id-preview--59b1571a-4d6d-4f7a-bc44-a71629828ed0.lovable.app',
  'https://59b1571a-4d6d-4f7a-bc44-a71629828ed0.lovableproject.com',
]);

export type GasbeePaymentSource = 'app' | 'web';

type PaymentOutcome = 'success' | 'failed';
type PaymentReturnRoute = 'website_order' | 'app_order' | 'app_bridge';

export function paymentReturnRoute(url: URL, orderId: string, outcome: PaymentOutcome): PaymentReturnRoute | undefined {
  if (url.username || url.password || url.hash) return;
  if (url.search === `?payment=${outcome}`) {
    if (url.pathname === `/order/orders/${orderId}`) return 'website_order';
    if (url.pathname === `/user/orders/${orderId}`) return 'app_order';
  }
  if (
    url.pathname === '/payment-bridge' &&
    url.searchParams.get('status') === outcome &&
    url.searchParams.get('order_id') === orderId &&
    [...url.searchParams].length === 2
  ) return 'app_bridge';
}

export function inferGasbeePaymentSource(
  orderId: string, success: unknown, failure: unknown, includeLegacy = false,
): GasbeePaymentSource | undefined {
  if (typeof success !== 'string' || typeof failure !== 'string') return;

  try {
    const successUrl = new URL(success);
    const failureUrl = new URL(failure);
    if (successUrl.origin !== failureUrl.origin) return;

    // Old stored redirects can identify the source without becoming valid return pages for new purchases.
    if (
      includeLegacy &&
      successUrl.href === `${LEGACY_VERCEL_ORIGIN}/payment-success?order_id=${orderId}` &&
      failureUrl.href === `${LEGACY_VERCEL_ORIGIN}/payment-failed?order_id=${orderId}`
    ) return 'app';

    const route = paymentReturnRoute(successUrl, orderId, 'success');
    if (!route || route !== paymentReturnRoute(failureUrl, orderId, 'failed')) return;

    const isPortal = PORTAL_ORIGINS.has(successUrl.origin);
    if (route === 'website_order') {
      return isPortal || (includeLegacy && LEGACY_WEBSITE_ORIGINS.has(successUrl.origin)) ? 'web' : undefined;
    }
    if (isPortal || V2_ORIGINS.includes(successUrl.origin) || (includeLegacy && LEGACY_APP_ORIGINS.has(successUrl.origin))) return 'app';
  } catch {
    // Some older payment records omit return pages or store invalid URLs.
  }
}

export function getGasbeePaymentSource(rawPayload: unknown, orderId: string): GasbeePaymentSource | undefined {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return;
  const payload = rawPayload as Record<string, unknown>;
  const source = payload._gasbee_checkout_source;
  if (source === 'app' || source === 'web') return source;
  return inferGasbeePaymentSource(orderId, payload.success_redirect, payload.failure_redirect, true);
}

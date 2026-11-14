import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createChipPurchase, PurchaseRequestError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

Deno.serve(createChipPurchase({
  callbackUrl: `${url}/functions/v1/chip-webhook`,
  returnOrigins: (Deno.env.get('CHIP_RETURN_ORIGINS') ?? '').split(','),
  log: (code) => console.warn(code),
  async authenticate(auth) {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    const { data: profile } = await client.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle();
    return { id: user.id, email: user.email, name: profile?.full_name, phone: profile?.phone };
  },
  async gatewayConfig() {
    const { data: gateway, error } = await admin.from('payment_gateways')
      .select('enabled,mode,config').eq('provider', 'chip').maybeSingle();
    if (error || !gateway?.enabled) throw new PurchaseRequestError(503, 'Online payment is temporarily unavailable');
    const values = (gateway.config ?? {}) as Record<string, string | undefined>;
    const apiKey = (values.api_key || Deno.env.get('CHIP_API_KEY') || '').trim();
    const brandId = (values.brand_id || Deno.env.get('CHIP_BRAND_ID') || '').trim();
    if (!apiKey || !brandId || !['sandbox', 'live'].includes(gateway.mode)) {
      throw new PurchaseRequestError(503, 'Online payment is temporarily unavailable');
    }
    return { apiKey, brandId, isTest: gateway.mode === 'sandbox' };
  },
  async begin(orderId, customerId) {
    const { data, error } = await admin.rpc('begin_chip_order_payment', { p_order_id: orderId, p_customer_id: customerId });
    if (error?.code === '42501') throw new PurchaseRequestError(404, 'Order not found');
    if (error?.code === '22023') throw new PurchaseRequestError(409, 'This order is not available for payment');
    if (error) throw new Error('reservation_failed');
    return data;
  },
  async finish(paymentId, gatewayRef, payload) {
    const { error } = await admin.rpc('finish_chip_order_payment', {
      p_payment_id: paymentId, p_gateway_ref: gatewayRef, p_gateway_payload: payload,
    });
    if (error) throw new Error('finish_failed');
  },
  async retire(paymentId, gatewayRef, status) {
    const { error } = await admin.rpc('retire_chip_order_payment', {
      p_payment_id: paymentId, p_gateway_ref: gatewayRef, p_verified_status: status,
    });
    if (error) throw new Error('retire_failed');
  },
  async finalize(payload, config) {
    const { data, error } = await admin.rpc('apply_chip_collect_notification', {
      p_purchase: payload, p_configured_brand: config.brandId, p_configured_is_test: config.isTest,
    });
    if (error || !data || ['rejected', 'unknown_purchase'].includes(data.result)) throw new Error('finalize_failed');
  },
}));

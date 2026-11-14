import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createChipWebhook, type Finalization } from './handler.ts';

const outcomes = new Set<Finalization>(['applied', 'duplicate', 'no_change', 'test_ignored', 'review', 'unknown_purchase', 'rejected']);
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceKey) throw new Error('CHIP backend configuration unavailable');
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function registeredKeys(): string[] {
  const env = Deno.env.get('CHIP_REGISTERED_WEBHOOK_PUBLIC_KEYS');
  if (!env) return [];
  const keys: unknown = JSON.parse(env);
  if (!Array.isArray(keys) || keys.length > 6 || keys.some((key) => typeof key !== 'string' || key.length > 8192)) {
    throw new Error('CHIP webhook public keys invalid');
  }
  return keys;
}

Deno.serve(createChipWebhook({
  async gatewayConfig() {
    const { data, error } = await db.from('payment_gateways').select('mode,config').eq('provider', 'chip').maybeSingle();
    if (error) throw new Error('CHIP gateway lookup failed');
    const config = data?.config as { api_key?: string; brand_id?: string } | null;
    const apiKey = (config?.api_key || Deno.env.get('CHIP_API_KEY') || '').trim();
    const brandId = (config?.brand_id || Deno.env.get('CHIP_BRAND_ID') || '').trim();
    if (!apiKey || !brandId) throw new Error('CHIP gateway configuration unavailable');
    return { apiKey, brandId, isTest: data?.mode === 'live' ? false : data?.mode === 'sandbox' ? true : null, registeredWebhookKeys: registeredKeys() };
  },
  async finalize(purchase, config) {
    const { data, error } = await db.rpc('apply_chip_collect_notification', {
      p_purchase: purchase,
      p_configured_brand: config.brandId,
      p_configured_is_test: config.isTest,
    });
    if (error || !outcomes.has(data?.result)) throw new Error('CHIP reconciliation write failed');
    if (data?.result === 'review') console.warn('chip-webhook reconciliation_required', purchase.id);
    return data.result;
  },
  log(code) { console.warn('chip-webhook', code); },
}));

// Edge function: admin-update-merchant
// Admin updates merchant fields and/or resets the owner password.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: rolesRows } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (rolesRows ?? []).some((r) => ["super_admin","admin","operation_admin","finance_admin","support_admin"].includes(r.role));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { merchant_id, fields, new_password, new_email } = body ?? {};
    if (!merchant_id) {
      return new Response(JSON.stringify({ error: "merchant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: merchant, error: mGetErr } = await admin.from("merchants").select("*").eq("id", merchant_id).maybeSingle();
    if (mGetErr || !merchant) {
      return new Response(JSON.stringify({ error: "Merchant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (fields && typeof fields === "object") {
      const allowed = ["name","slug","email","phone","address","city","state","postcode","status","description","logo_url","commission_rate"];
      const patch: Record<string, any> = {};
      for (const k of allowed) if (k in fields) patch[k] = fields[k];
      if (Object.keys(patch).length) {
        const { error } = await admin.from("merchants").update(patch).eq("id", merchant_id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if ((new_password || new_email) && merchant.owner_id) {
      const updates: any = {};
      if (new_password) {
        if (String(new_password).length < 6) {
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        updates.password = new_password;
      }
      if (new_email) { updates.email = new_email; updates.email_confirm = true; }
      const { error: uErr } = await admin.auth.admin.updateUserById(merchant.owner_id, updates);
      if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

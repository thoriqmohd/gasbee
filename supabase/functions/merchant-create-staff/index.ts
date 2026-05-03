// Edge function: merchant-create-staff
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
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: rolesRows } = await admin.from("user_roles").select("role, merchant_id").eq("user_id", userData.user.id);
    const ownerRow = (rolesRows ?? []).find((r) => ["merchant_owner", "merchant_manager"].includes(r.role) && r.merchant_id);
    if (!ownerRow) return new Response(JSON.stringify({ error: "Only merchant managers can add staff" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const merchant_id = ownerRow.merchant_id as string;

    const { email, password, full_name, phone, role } = await req.json();
    if (!email || !password || !full_name || !phone || !role) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!["merchant_staff", "merchant_manager"].includes(role)) return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } });
    if (createErr || !created.user) return new Response(JSON.stringify({ error: createErr?.message ?? "Failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("profiles").upsert({ id: created.user.id, full_name, phone });
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role, merchant_id });
    if (roleErr) return new Response(JSON.stringify({ error: roleErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

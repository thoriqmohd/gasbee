// Edge function: merchant-create-rider
// Creates an auth user for a rider, assigns merchant_rider role, creates riders row.
// Caller must be authenticated and be a merchant_owner/merchant_manager.
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

    // Verify caller is merchant manager / owner
    const { data: rolesRows } = await admin.from("user_roles").select("role, merchant_id").eq("user_id", callerId);
    const mgrRow = (rolesRows ?? []).find((r) => ["merchant_owner", "merchant_manager"].includes(r.role) && r.merchant_id);
    if (!mgrRow) {
      return new Response(JSON.stringify({ error: "Only merchant managers can add riders" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const merchant_id = mgrRow.merchant_id as string;

    const body = await req.json();
    const { email, password, full_name, phone, vehicle_type, vehicle_plate, license_no } = body ?? {};
    if (!email || !password || !full_name || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, phone },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const newUserId = created.user.id;

    // Profile may have been auto-created by trigger; ensure row exists
    await admin.from("profiles").upsert({ id: newUserId, full_name, phone });

    // Remove default 'customer' role added by trigger, assign merchant_rider with merchant_id
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role: "merchant_rider", merchant_id });
    if (roleErr) {
      return new Response(JSON.stringify({ error: roleErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create rider row
    const { data: rider, error: riderErr } = await admin.from("riders").insert({
      user_id: newUserId, merchant_id, full_name, phone,
      vehicle_type: vehicle_type ?? null, vehicle_plate: vehicle_plate ?? null, license_no: license_no ?? null,
    }).select().single();
    if (riderErr) {
      return new Response(JSON.stringify({ error: riderErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ rider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

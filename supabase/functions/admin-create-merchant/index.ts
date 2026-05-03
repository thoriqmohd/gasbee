// Edge function: admin-create-merchant
// Admin creates a merchant + owner auth user with provided password.
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
    const { name, slug, email, password, phone, address, city, state, postcode } = body ?? {};
    if (!name || !slug || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields (name, slug, email, password)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if user already exists
    let ownerId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (found) {
      ownerId = found.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: name, phone },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      ownerId = created.user.id;
    }

    await admin.from("profiles").upsert({ id: ownerId!, full_name: name, phone: phone ?? null });

    // Create merchant
    const { data: merchant, error: mErr } = await admin.from("merchants").insert({
      name, slug, email, phone: phone ?? null, address: address ?? null,
      city: city ?? null, state: state ?? null, postcode: postcode ?? null,
      owner_id: ownerId, status: "active",
    }).select().single();
    if (mErr) {
      return new Response(JSON.stringify({ error: mErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Remove default 'customer' role and assign merchant_owner + merchant_manager
    await admin.from("user_roles").delete().eq("user_id", ownerId).in("role", ["customer","merchant_owner","merchant_manager"]);
    await admin.from("user_roles").insert([
      { user_id: ownerId, role: "merchant_owner", merchant_id: merchant.id },
      { user_id: ownerId, role: "merchant_manager", merchant_id: merchant.id },
    ]);

    return new Response(JSON.stringify({ merchant, owner_id: ownerId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

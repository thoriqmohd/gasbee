// Edge function: merchant-create-rider
// Creates an auth user for a rider, assigns merchant_rider role, creates riders row.
// Caller must be authenticated and be a merchant_owner/merchant_manager.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Your session has expired. Please sign in again." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Your session has expired. Please sign in again." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is merchant manager / owner
    const { data: rolesRows } = await admin.from("user_roles").select("role, merchant_id").eq("user_id", callerId);
    const mgrRow = (rolesRows ?? []).find((r) => ["merchant_owner", "merchant_manager"].includes(r.role) && r.merchant_id);
    if (!mgrRow) {
      return new Response(JSON.stringify({ error: "Only merchant managers can add riders" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const merchant_id = mgrRow.merchant_id as string;

    const body = await req.json();
    const { email, password, full_name, phone, vehicle_type, vehicle_plate, license_no } = body ?? {};
    if (!email || !password || !full_name || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const normEmail = String(email).trim().toLowerCase();

    // Create auth user, or reuse an existing account with this email
    let newUserId: string;
    let isExisting = false;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normEmail, password, email_confirm: true, user_metadata: { full_name, phone },
    });
    if (created?.user) {
      newUserId = created.user.id;
    } else if ((createErr as any)?.code === "email_exists" || /already been registered/i.test(createErr?.message ?? "")) {
      let found: any = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr) return json({ error: listErr.message }, 200);
        found = list.users.find((u) => (u.email ?? "").toLowerCase() === normEmail);
        if (list.users.length < 1000) break;
      }
      if (!found) return json({ error: "This email is already registered. Please use a different email." }, 200);
      newUserId = found.id;
      isExisting = true;

      const { data: existingRoles } = await admin.from("user_roles").select("role, merchant_id").eq("user_id", newUserId);
      const roles = existingRoles ?? [];
      if (roles.some((r) => r.role === "customer" || r.role === "buyer")) {
        return json({ error: "This email is already registered as a customer account. Please use a different email for the rider." }, 200);
      }
      const blocked = roles.find((r) => !(r.role === "merchant_rider" && r.merchant_id === merchant_id));
      if (blocked) return json({ error: "This email already belongs to a staff, admin or another merchant's account. Please use a different email." }, 200);
      const { data: existingRider } = await admin.from("riders").select("id, merchant_id").eq("user_id", newUserId).maybeSingle();
      if (existingRider) return json({ error: existingRider.merchant_id === merchant_id ? "This rider is already registered in your shop." : "This email is already registered as a rider for another merchant." }, 200);
    } else {
      return json({ error: /weak|easy to guess|pwned/i.test(createErr?.message ?? "") ? "This password is too common. Please use a stronger password (mix letters, numbers and symbols)." : (createErr?.message ?? "Failed to create user") }, 200);
    }

    // Profile may have been auto-created by trigger; ensure row exists
    if (!isExisting) await admin.from("profiles").upsert({ id: newUserId, full_name, phone });

    // New accounts: replace default 'customer' role. Existing accounts keep their customer role.
    if (!isExisting) await admin.from("user_roles").delete().eq("user_id", newUserId);
    const { data: hasRole } = await admin.from("user_roles").select("id").eq("user_id", newUserId).eq("role", "merchant_rider").eq("merchant_id", merchant_id).maybeSingle();
    const { error: roleErr } = hasRole ? { error: null } : await admin.from("user_roles").insert({ user_id: newUserId, role: "merchant_rider", merchant_id });
    if (roleErr) return json({ error: roleErr.message }, 200);

    // Create rider row
    const { data: rider, error: riderErr } = await admin.from("riders").insert({
      user_id: newUserId, merchant_id, full_name, phone,
      vehicle_type: vehicle_type ?? null, vehicle_plate: vehicle_plate ?? null, license_no: license_no ?? null,
    }).select().single();
    if (riderErr) {
      return new Response(JSON.stringify({ error: riderErr.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ rider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

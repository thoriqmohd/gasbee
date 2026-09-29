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
        if (listErr) return json({ error: listErr.message }, 400);
        found = list.users.find((u) => (u.email ?? "").toLowerCase() === normEmail);
        if (list.users.length < 1000) break;
      }
      if (!found) return json({ error: "This email is already registered. Please use a different email." }, 409);
      newUserId = found.id;
      isExisting = true;

      const { data: existingRoles } = await admin.from("user_roles").select("role, merchant_id").eq("user_id", newUserId);
      const blocked = (existingRoles ?? []).find((r) => r.role !== "customer" && r.role !== "buyer" && !(r.role === "merchant_rider" && r.merchant_id === merchant_id));
      if (blocked) return json({ error: "This email already belongs to a staff, admin or another merchant's account. Please use a different email." }, 409);
      const { data: existingRider } = await admin.from("riders").select("id, merchant_id").eq("user_id", newUserId).maybeSingle();
      if (existingRider) return json({ error: existingRider.merchant_id === merchant_id ? "This rider is already registered in your shop." : "This email is already registered as a rider for another merchant." }, 409);
    } else {
      return json({ error: createErr?.message ?? "Failed to create user" }, 400);
    }

    // Profile may have been auto-created by trigger; ensure row exists
    if (!isExisting) await admin.from("profiles").upsert({ id: newUserId, full_name, phone });

    // New accounts: replace default 'customer' role. Existing accounts keep their customer role.
    if (!isExisting) await admin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: newUserId, role: "merchant_rider", merchant_id },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    if (roleErr) return json({ error: roleErr.message }, 400);

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

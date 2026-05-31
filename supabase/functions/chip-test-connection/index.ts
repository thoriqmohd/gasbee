import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Unauthorized");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // admin check
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["super_admin", "admin", "operation_admin", "finance_admin", "support_admin"].includes(r.role)
    );
    if (!isAdmin) throw new Error("Forbidden");

    const { mode, api_key, brand_id } = await req.json();
    if (!api_key) throw new Error("api_key required");
    if (!brand_id) throw new Error("brand_id required");

    const base = mode === "live"
      ? "https://gate.chip-in.asia/api/v1"
      : "https://gate.chip-in.asia/api/v1"; // CHIP uses same host; sandbox = test brand/key
    const res = await fetch(`${base}/account/json/`, {
      headers: { Authorization: `Bearer ${api_key}` },
    });
    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `CHIP ${res.status}: ${text.slice(0, 300)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    return new Response(
      JSON.stringify({
        ok: true,
        message: parsed?.email
          ? `Connected as ${parsed.email}`
          : "Credentials valid — CHIP responded successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

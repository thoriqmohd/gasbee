import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isSandbox = (Deno.env.get("BILLPLZ_SANDBOX") ?? "true").toLowerCase() !== "false";
const BILLPLZ_BASE = isSandbox ? "https://www.billplz-sandbox.com/api/v3" : "https://www.billplz.com/api/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("BILLPLZ_API_KEY");
    const collectionId = Deno.env.get("BILLPLZ_COLLECTION_ID");
    if (!apiKey || !collectionId) throw new Error("Billplz not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Unauthorized");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { order_id, redirect_url } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error: oerr } = await supabase.from("orders").select("*").eq("id", order_id).maybeSingle();
    if (oerr || !order) throw new Error("Order not found");
    if (order.customer_id !== user.id) throw new Error("Forbidden");

    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/billplz-webhook`;
    const amountCents = Math.round(Number(order.total_amount) * 100);

    const body = new URLSearchParams({
      collection_id: collectionId,
      email: user.email ?? "noreply@gasbee.app",
      name: profile?.full_name || (user.email ?? "Customer"),
      amount: String(amountCents),
      callback_url: callbackUrl,
      description: `Order ${order.code}`,
      reference_1_label: "OrderID",
      reference_1: order.id,
    });
    if (redirect_url) body.append("redirect_url", redirect_url);
    if (profile?.phone) body.append("mobile", profile.phone);

    const res = await fetch(`${BILLPLZ_BASE}/bills`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${apiKey}:`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const bill = await res.json();
    if (!res.ok) throw new Error(`Billplz: ${JSON.stringify(bill)}`);

    // Save payment record
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("payments").insert({
      order_id: order.id,
      gateway: "billplz",
      gateway_ref: bill.id,
      amount: order.total_amount,
      status: "pending",
      raw_payload: bill,
    });

    return new Response(JSON.stringify({ url: bill.url, bill_id: bill.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

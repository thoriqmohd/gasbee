import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify Billplz X-Signature: sort key|value pairs (excluding x_signature) by key, join with "|", HMAC-SHA256
async function verifySignature(params: Record<string, string>, key: string): Promise<boolean> {
  const sig = params["x_signature"];
  if (!sig) return false;
  const sorted = Object.keys(params).filter((k) => k !== "x_signature").sort();
  const source = sorted.map((k) => `${k}${params[k]}`).join("|");
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(source));
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const xkey = Deno.env.get("BILLPLZ_X_SIGNATURE_KEY");
    if (!xkey) throw new Error("X signature key not set");

    // Billplz sends application/x-www-form-urlencoded for both callback and redirect
    const ct = req.headers.get("content-type") ?? "";
    let params: Record<string, string> = {};
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const usp = new URLSearchParams(text);
      usp.forEach((v, k) => { params[k] = v; });
    } else {
      const body = await req.json().catch(() => ({}));
      Object.assign(params, body);
    }

    const ok = await verifySignature(params, xkey);
    if (!ok) {
      console.error("Invalid Billplz signature", params);
      return new Response("invalid signature", { status: 400, headers: corsHeaders });
    }

    const billId = params["id"];
    const paid = (params["paid"] ?? "").toLowerCase() === "true";
    const orderId = params["reference_1"];
    if (!orderId || !billId) throw new Error("Missing references");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await admin.from("payments").update({
      status: paid ? "paid" : "failed",
      raw_payload: params,
    }).eq("gateway_ref", billId);

    if (paid) {
      await admin.from("orders").update({ payment_status: "paid" }).eq("id", orderId);
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

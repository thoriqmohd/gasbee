import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";

export default function UserPayment() {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => setOrder(data));
  }, [id]);

  const payNow = async () => {
    if (!order) return;
    setBusy(true);

    try {
      // Use the published domain for redirects so CHIP returns to the live app
      // (works whether we're inside the Lovable preview iframe or on the published domain).
      let redirectOrigin = window.location.origin;
      try {
        if (window.top && window.top !== window.self) {
          redirectOrigin = window.top.location.origin;
        }
      } catch {
        redirectOrigin = window.location.hostname.includes("lovableproject.com")
          ? "https://gasbee.com.my"
          : window.location.origin;
      }

      const isNative = Capacitor.isNativePlatform();
      // CHIP only accepts https-style redirect URLs (it rejects the gasbee://
      // scheme), so on native we point the gateway at the public web bridge
      // page, which bounces straight back into the app via the deep link.
      // VITE_BRIDGE_BASE_URL lets local testing target the dev server
      // (default: production domain).
      const bridgeBase = (import.meta.env.VITE_BRIDGE_BASE_URL || "https://gasbee.com.my").replace(/\/+$/, "");
      const success_redirect = isNative
        ? `${bridgeBase}/payment-bridge?status=success&order_id=${order.id}`
        : `${redirectOrigin}/user/orders/${order.id}?payment=success`;
      const failure_redirect = isNative
        ? `${bridgeBase}/payment-bridge?status=failed&order_id=${order.id}`
        : `${redirectOrigin}/user/orders/${order.id}?payment=failed`;

      const { data, error } = await supabase.functions.invoke("chip-create-purchase", {
        body: { order_id: order.id, success_redirect, failure_redirect },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL");

      // Native: open the checkout in the in-app browser instead of leaving the
      // app. When the overlay closes (abandoned, failed, or right after
      // paying), bring the user back to the order page — the deep-link return
      // lands there anyway, and the status updates via the webhook.
      if (isNative) {
        await Browser.open({ url: data.url });
        nav(`/user/orders/${order.id}`, { replace: true });
        return;
      }

      // Web: break out of any iframe (Lovable preview) by using a target="_top" anchor click.
      // This works cross-origin where window.top.location assignment is blocked,
      // and avoids loading CHIP in an iframe (which CHIP refuses via X-Frame-Options).
      const a = document.createElement("a");
      a.href = data.url;
      a.target = "_top";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      // Surface the real reason from the edge function body, not the generic
      // "non-2xx status code" message.
      let msg = e?.message ?? "Failed to start payment";
      if (e instanceof FunctionsHttpError) {
        try {
          const body = await e.context.json();
          if (body?.error) msg = body.error;
        } catch {
          // keep the generic message
        }
      }
      toast.error(msg);
      setBusy(false);
    }
  };

  if (!order) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const amount = Number(order.total_amount ?? 0);
  const amountInvalid = !(amount > 0);

  return (
    <div className="mx-auto max-w-md space-y-4 p-2">
      <div className="rounded-lg bg-gradient-to-r from-primary to-primary/70 p-4 text-primary-foreground">
        <div className="text-xs opacity-80">Secure Payment Gateway</div>
        <div className="text-lg font-bold">CHIP</div>
      </div>

      <Card className="space-y-2 p-4">
        <div className="text-xs text-muted-foreground">Order reference</div>
        <div className="font-mono font-semibold">{order.code}</div>
        <div className="mt-3 flex justify-between border-t pt-3 text-sm">
          <span>Amount due</span>
          <span className="text-lg font-bold text-primary">RM {Number(order.total_amount).toFixed(2)}</span>
        </div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Method: {order.payment_method === "fpx" ? "FPX (Online Transfer)" : (order.payment_method === "card" ? "Credit Card" : (order.payment_method === "cod" ? "COD (Cash on Delivery)" : order.payment_method?.toUpperCase()))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        {amountInvalid && (
          <p className="text-sm font-medium text-destructive">
            Jumlah pesanan tidak sah (RM 0.00). Pesanan ini tidak boleh dibayar — silakan batalkan dan buat pesanan semula, atau hubungi sokongan.
          </p>
        )}
        <Button className="w-full" disabled={busy || amountInvalid} onClick={payNow}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Pay with CHIP
        </Button>
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => nav(`/user/orders/${order.id}`)}>
          Cancel & back to order
        </Button>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Selepas bayar, anda akan kembali ke halaman pesanan secara automatik.
      </p>
    </div>
  );
}

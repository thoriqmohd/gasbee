import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => setOrder(data));
  }, [id]);

  const payNow = async () => {
    if (!order) return;
    setBusy(true);
    setCheckoutUrl(null);

    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("chip-create-purchase", {
        body: {
          order_id: order.id,
          success_redirect: `${origin}/user/orders/${order.id}?payment=success`,
          failure_redirect: `${origin}/user/orders/${order.id}?payment=failed`,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL");

      setCheckoutUrl(data.url);
      toast.success("CHIP checkout is ready. Tap Continue to open it in a new tab.");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start payment");
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = () => {
    if (!checkoutUrl) return;
    const opened = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      navigator.clipboard?.writeText(checkoutUrl).catch(() => undefined);
      toast.info("Popup blocked. Checkout link copied—paste it in a new browser tab.");
    }
  };

  if (!order) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

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
          Method: {order.payment_method?.toUpperCase()}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <Button className="w-full" disabled={busy} onClick={payNow}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Pay with CHIP
        </Button>
        {checkoutUrl && (
          <Button variant="secondary" className="w-full" onClick={openCheckout}>
            Continue to CHIP checkout
          </Button>
        )}
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => nav(`/user/orders/${order.id}`)}>
          Cancel & back to order
        </Button>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        You will be redirected to CHIP secure checkout.
      </p>
    </div>
  );
}

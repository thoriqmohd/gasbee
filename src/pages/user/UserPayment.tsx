import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function UserPayment() {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [busy, setBusy] = useState<"success" | "fail" | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("orders").select("*").eq("id", id).maybeSingle().then(({ data }) => setOrder(data));
  }, [id]);

  const finish = async (kind: "success" | "fail") => {
    if (!order) return;
    setBusy(kind);
    const payment_status = kind === "success" ? "paid" : "failed";
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", order.id);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("payments").insert({
      order_id: order.id,
      gateway: "dummy",
      gateway_ref: `DUMMY-${Date.now()}`,
      amount: order.total_amount,
      status: payment_status,
    } as any);
    toast[kind === "success" ? "success" : "error"](
      kind === "success" ? "Payment successful" : "Payment failed"
    );
    nav(`/user/orders/${order.id}`, { replace: true });
  };

  if (!order) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-md space-y-4 p-2">
      <div className="rounded-lg bg-gradient-to-r from-primary to-primary/70 p-4 text-primary-foreground">
        <div className="text-xs opacity-80">Sandbox Payment Gateway</div>
        <div className="text-lg font-bold">Billplz (Demo)</div>
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
        <div className="text-sm font-semibold">Simulate payment outcome</div>
        <Button
          className="w-full"
          disabled={!!busy}
          onClick={() => finish("success")}
        >
          {busy === "success" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Pay successfully
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          disabled={!!busy}
          onClick={() => finish("fail")}
        >
          {busy === "fail" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          Simulate failure
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={!!busy}
          onClick={() => nav(`/user/orders/${order.id}`)}
        >
          Cancel & back to order
        </Button>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Demo gateway — no real payment is processed.
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const RESTOCKING_RATE = 0.10;

const REASONS_PRE = [
  { v: "changed_mind", l: "Changed my mind" },
  { v: "wrong_item", l: "Selected wrong item" },
  { v: "duplicate", l: "Duplicate order" },
  { v: "other", l: "Other" },
];
const REASONS_POST = [
  { v: "wrong_item", l: "Incorrect item received" },
  { v: "damaged", l: "Cylinder damaged" },
  { v: "leakage", l: "Gas leakage" },
  { v: "quality", l: "Unsatisfactory quality" },
  { v: "wrong_address", l: "Delivered to wrong address" },
  { v: "other", l: "Other" },
];

type Stage = "pre_dispatch" | "in_transit" | "delivered";

function stageOf(o: any): Stage | null {
  if (!o) return null;
  if (o.status === "delivered") return "delivered";
  if (["picked_up", "on_delivery", "arrived_at_customer", "out_for_delivery"].includes(o.status)) return "in_transit";
  if (["pending", "confirmed", "preparing", "rider_accepted", "arrived_at_merchant"].includes(o.status)) return "pre_dispatch";
  return null;
}

const fmt = (n: number) => `RM ${n.toFixed(2)}`;

export default function UserRefund() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const orderId = params.get("order") ?? "";
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [reasonCat, setReasonCat] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle().then(({ data }) => setOrder(data));
  }, [orderId]);

  const stage = useMemo(() => stageOf(order), [order]);

  const breakdown = useMemo(() => {
    if (!order) return null;
    const total = Number(order.total_amount);
    const itemsSubtotal = Number(order.items_subtotal);
    const deliveryFee = Number(order.delivery_fee);
    if (stage === "pre_dispatch") {
      return { delivery_fee_charged: 0, restocking_fee: 0, refund_amount: total };
    }
    if (stage === "in_transit") {
      const restock = Math.round(itemsSubtotal * RESTOCKING_RATE * 100) / 100;
      return { delivery_fee_charged: deliveryFee, restocking_fee: restock, refund_amount: Math.max(0, total - deliveryFee - restock) };
    }
    return { delivery_fee_charged: deliveryFee, restocking_fee: 0, refund_amount: itemsSubtotal };
  }, [order, stage]);

  const submit = async () => {
    if (!order || !breakdown) return;
    if (order.payment_status !== "paid") { toast.error("Refund is only available after payment is confirmed."); return; }
    if (!stage) { toast.error("This order is not eligible for a refund."); return; }
    if (!reasonCat) { toast.error("Please select a refund reason."); return; }
    if (stage !== "pre_dispatch" && reason.trim().length < 5) { toast.error("Please provide more details."); return; }
    setBusy(true);
    const { error } = await supabase.from("refunds").insert({
      order_id: order.id,
      requester_id: user!.id,
      amount: breakdown.refund_amount,
      reason: (reason || REASONS_PRE.concat(REASONS_POST).find(r => r.v === reasonCat)?.l || "—").slice(0, 500),
      reason_category: reasonCat,
      stage: stage as any,
      delivery_fee_charged: breakdown.delivery_fee_charged,
      restocking_fee: breakdown.restocking_fee,
      refund_amount: breakdown.refund_amount,
      pickup_status: stage === "delivered" ? "pending" as any : "not_required" as any,
      pickup_rider_id: stage === "delivered" ? order.rider_id : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Refund request submitted.");
    nav(`/user/orders/${order.id}`);
  };

  if (!order) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (order.payment_status !== "paid") {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold">Refund unavailable</h1>
        <Card className="border-amber-500 bg-amber-500/10 p-3 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />Refunds can only be requested after payment is confirmed (paid).</Card>
        <Button variant="outline" onClick={() => nav(-1)}>Back</Button>
      </div>
    );
  }

  if (!stage) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold">Not eligible</h1>
        <Card className="p-3 text-sm">This order is not eligible for a refund.</Card>
      </div>
    );
  }

  const reasons = stage === "pre_dispatch" ? REASONS_PRE : REASONS_POST;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Request refund</h1>

      <Card className="p-3 text-sm">
        <div className="font-semibold">{order.code}</div>
        <div className="text-xs text-muted-foreground">Total paid: {fmt(Number(order.total_amount))}</div>
        <div className="text-xs text-muted-foreground">Status: {order.status.replace(/_/g, " ")}</div>
      </Card>

      <Card className="p-3 text-sm">
        <div className="mb-2 font-semibold">Refund calculation</div>
        {stage === "pre_dispatch" && <p className="text-xs text-muted-foreground">Rider has not departed. You will receive a full refund.</p>}
        {stage === "in_transit" && <p className="text-xs text-muted-foreground">Rider is on the way — delivery fee + 10% restocking fee will be charged (rider will return to merchant).</p>}
        {stage === "delivered" && <p className="text-xs text-muted-foreground">Goods already delivered — the same rider will come to collect the cylinder. Refund will be processed after pickup is completed.</p>}
        <div className="mt-2 space-y-1 border-t pt-2">
          <div className="flex justify-between"><span>Original payment</span><span>{fmt(Number(order.total_amount))}</span></div>
          {breakdown!.delivery_fee_charged > 0 && <div className="flex justify-between text-destructive"><span>− Delivery fee</span><span>{fmt(breakdown!.delivery_fee_charged)}</span></div>}
          {breakdown!.restocking_fee > 0 && <div className="flex justify-between text-destructive"><span>− Restocking 10%</span><span>{fmt(breakdown!.restocking_fee)}</span></div>}
          <div className="flex justify-between border-t pt-1 font-bold"><span>Refund to you</span><span className="text-primary">{fmt(breakdown!.refund_amount)}</span></div>
        </div>
      </Card>

      <div>
        <Label>Refund reason *</Label>
        <RadioGroup value={reasonCat} onValueChange={setReasonCat} className="mt-2 space-y-2">
          {reasons.map((r) => (
            <Card key={r.v} className="flex items-center gap-2 p-3">
              <RadioGroupItem value={r.v} id={r.v} />
              <Label htmlFor={r.v} className="cursor-pointer text-sm">{r.l}</Label>
            </Card>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label>Details {stage !== "pre_dispatch" && "*"}</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Provide more information" />
      </div>

      <Button className="w-full" onClick={submit} disabled={busy || !reasonCat}>{busy ? "Submitting…" : "Submit refund request"}</Button>
    </div>
  );
}

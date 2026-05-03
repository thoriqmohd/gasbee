import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function UserRefund() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const orderId = params.get("order") ?? "";
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [form, setForm] = useState({ amount: "", reason: "", notes: "" });

  useEffect(() => {
    if (!orderId) return;
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle().then(({ data }) => {
      setOrder(data);
      if (data) setForm((f) => ({ ...f, amount: String(data.total_amount) }));
    });
  }, [orderId]);

  const submit = async () => {
    if (!order || !form.reason.trim()) { toast.error("Reason required"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0 || amt > Number(order.total_amount)) { toast.error("Invalid amount"); return; }
    const { error } = await supabase.from("refunds").insert({
      order_id: order.id, requester_id: user!.id, amount: amt, reason: form.reason.trim().slice(0, 500), notes: form.notes.trim().slice(0, 1000),
    });
    if (error) toast.error(error.message); else { toast.success("Refund requested"); nav(`/user/orders/${order.id}`); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Request refund</h1>
      {order && <Card className="p-3 text-sm"><div className="font-semibold">{order.code}</div><div className="text-muted-foreground">Total: RM {Number(order.total_amount).toFixed(2)}</div></Card>}
      <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
      <div><Label>Reason *</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} /></div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
      <Button className="w-full" onClick={submit} disabled={!order}>Submit refund request</Button>
    </div>
  );
}

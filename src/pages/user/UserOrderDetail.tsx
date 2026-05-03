import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";

const STEPS = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

export default function UserOrderDetail() {
  const { id } = useParams();
  const [o, setO] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: order } = await supabase.from("orders").select("*, merchants(name, phone), riders(full_name, phone)").eq("id", id).maybeSingle();
      setO(order);
      const { data: oi } = await supabase.from("order_items").select("*").eq("order_id", id);
      setItems(oi ?? []);
    };
    load();
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const stepIdx = STEPS.indexOf(o.status);
  const cancel = async () => {
    const { error } = await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success("Cancelled"); setO({ ...o, status: "cancelled" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{o.code}</h1>
        <StatusBadge status={o.status} />
      </div>

      {stepIdx >= 0 && o.status !== "cancelled" && (
        <Card className="p-3">
          <div className="mb-2 text-sm font-semibold">Tracking</div>
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center text-center">
                <div className={`h-3 w-3 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
                <div className="mt-1 text-[10px] capitalize text-muted-foreground">{s.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-1 p-3 text-sm">
        <div className="font-semibold">Merchant</div>
        <div>{o.merchants?.name}</div>
        {o.merchants?.phone && <div className="text-xs text-muted-foreground">{o.merchants.phone}</div>}
      </Card>

      {o.riders && (
        <Card className="space-y-1 p-3 text-sm">
          <div className="font-semibold">Rider</div>
          <div>{o.riders.full_name}</div>
          <div className="text-xs text-muted-foreground">{o.riders.phone}</div>
        </Card>
      )}

      <Card className="p-3">
        <div className="mb-1 text-sm font-semibold">Delivery to</div>
        <div className="text-xs text-muted-foreground">
          {o.address_snapshot?.address_line1}, {o.address_snapshot?.postcode} {o.address_snapshot?.city}
        </div>
      </Card>

      <Card className="divide-y">
        {items.map((it) => (
          <div key={it.id} className="flex justify-between p-3 text-sm">
            <span>{it.product_name} × {it.quantity}</span>
            <span>RM {Number(it.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </Card>

      <Card className="space-y-1 p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>RM {Number(o.items_subtotal).toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Delivery</span><span>RM {Number(o.delivery_fee).toFixed(2)}</span></div>
        {Number(o.discount) > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>- RM {Number(o.discount).toFixed(2)}</span></div>}
        <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="text-primary">RM {Number(o.total_amount).toFixed(2)}</span></div>
      </Card>

      <div className="flex gap-2">
        {["pending","confirmed"].includes(o.status) && <Button variant="destructive" className="flex-1" onClick={cancel}>Cancel</Button>}
        {o.status === "delivered" && <Button asChild variant="outline" className="flex-1"><Link to={`/user/refund?order=${o.id}`}>Request refund</Link></Button>}
      </div>
    </div>
  );
}

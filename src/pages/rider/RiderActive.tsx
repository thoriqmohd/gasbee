import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FLOW: Record<string, string> = {
  rider_accepted: "arrived_at_merchant",
  arrived_at_merchant: "picked_up",
  picked_up: "on_delivery",
  on_delivery: "arrived_at_customer",
  arrived_at_customer: "delivered",
};

export default function RiderActive() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("riders").select("id").eq("user_id", user.id).maybeSingle();
    if (!r) return;
    const { data } = await supabase.from("orders").select("*").eq("rider_id", r.id).in("status", ["rider_accepted","arrived_at_merchant","picked_up","on_delivery","arrived_at_customer"]).order("created_at", { ascending: false });
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const advance = async (o: any) => {
    const next = FLOW[o.status];
    if (!next) return;
    const stamp: any = {};
    if (next === "picked_up") stamp.picked_up_at = new Date().toISOString();
    if (next === "delivered") stamp.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update({ status: next as any, ...stamp }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success(`Marked ${next.replace(/_/g," ")}`); load(); }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Active deliveries</h1>
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No active delivery.</p>}
      {orders.map((o) => (
        <Card key={o.id} className="space-y-2 p-4">
          <div className="flex justify-between"><span className="font-mono">{o.code}</span><span className="text-xs uppercase">{o.status.replace(/_/g," ")}</span></div>
          <p className="text-sm">{o.address_snapshot?.recipient_name} — {o.address_snapshot?.recipient_phone}</p>
          <p className="text-sm text-muted-foreground">{o.address_snapshot?.address_line1}, {o.address_snapshot?.city}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1"><Link to={`/merchant/rider/jobs/${o.id}`}>Details</Link></Button>
            {FLOW[o.status] && <Button size="sm" className="flex-1" onClick={() => advance(o)}>Mark {FLOW[o.status].replace(/_/g," ")}</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

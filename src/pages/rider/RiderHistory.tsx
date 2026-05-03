import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function RiderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: r } = await supabase.from("riders").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) return;
      const { data } = await supabase.from("orders").select("*").eq("rider_id", r.id).in("status", ["delivered","failed","cancelled"]).order("created_at", { ascending: false }).limit(100);
      setOrders(data ?? []);
    })();
  }, [user?.id]);
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">History</h1>
      {orders.map((o) => (
        <Card key={o.id} className="flex items-center justify-between p-3">
          <div><p className="font-mono text-sm">{o.code}</p><p className="text-xs text-muted-foreground">{new Date(o.delivered_at || o.created_at).toLocaleString()}</p></div>
          <div className="text-right"><StatusBadge value={o.status} /><p className="mt-1 text-sm font-bold">{fmt(o.delivery_fee)}</p></div>
        </Card>
      ))}
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No history.</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function UserOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*, merchants(name)").eq("customer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
  }, [user]);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">My Orders</h1>
      {orders.map((o) => (
        <Link key={o.id} to={`/user/orders/${o.id}`}>
          <Card className="space-y-1 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{o.code}</span>
              <StatusBadge value={o.status} />
            </div>
            <div className="text-xs text-muted-foreground">{o.merchants?.name} · {new Date(o.created_at).toLocaleString()}</div>
            <div className="text-sm font-bold text-primary">RM {Number(o.total_amount).toFixed(2)}</div>
          </Card>
        </Link>
      ))}
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
    </div>
  );
}

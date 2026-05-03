import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function RiderDashboard() {
  const { user } = useAuth();
  const [rider, setRider] = useState<any>(null);
  const [stats, setStats] = useState({ today: 0, earnings: 0, active: 0, available: 0 });

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("riders").select("*").eq("user_id", user.id).maybeSingle();
    setRider(r);
    if (!r) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const [del, act, avail] = await Promise.all([
      supabase.from("orders").select("total_amount,delivery_fee", { count: "exact" }).eq("rider_id", r.id).eq("status", "delivered").gte("delivered_at", today.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("rider_id", r.id).in("status", ["assigned","rider_accepted","arrived_at_merchant","picked_up","on_delivery","arrived_at_customer"]),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("merchant_id", r.merchant_id).is("rider_id", null).in("status", ["accepted","preparing"]),
    ]);
    const earnings = (del.data ?? []).reduce((s: number, o: any) => s + Number(o.delivery_fee || 0), 0);
    setStats({ today: del.count ?? 0, earnings, active: act.count ?? 0, available: avail.count ?? 0 });
  };
  useEffect(() => { load(); }, [user?.id]);

  const toggleStatus = async (online: boolean) => {
    if (!rider) return;
    const status = online ? "online" : "offline";
    const { error } = await supabase.from("riders").update({ status }).eq("id", rider.id);
    if (error) toast.error(error.message); else { toast.success(online ? "Online" : "Offline"); load(); }
  };

  if (!rider) return <p className="text-sm text-muted-foreground">Rider profile not linked. Contact merchant.</p>;
  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="text-lg font-bold capitalize">{rider.status}</p>
        </div>
        <Switch checked={rider.status === "online"} onCheckedChange={toggleStatus} />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Today deliveries</p><p className="text-2xl font-bold">{stats.today}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Today earnings</p><p className="text-2xl font-bold">{fmt(stats.earnings)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Active jobs</p><p className="text-2xl font-bold">{stats.active}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Available</p><p className="text-2xl font-bold">{stats.available}</p></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button asChild><Link to="/merchant/rider/jobs">Browse jobs</Link></Button>
        <Button asChild variant="outline"><Link to="/merchant/rider/active-delivery">Active delivery</Link></Button>
      </div>
    </div>
  );
}

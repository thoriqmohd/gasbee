import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Package, Bike, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const Stat = ({ label, value, icon: Icon }: any) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></div>
    </div>
  </Card>
);

export default function MerchantDashboard() {
  const { merchant, loading } = useMerchantContext();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const [todayRes, paidRes, pendRes, prodRes, ridRes, recentRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id).gte("created_at", today.toISOString()),
        supabase.from("orders").select("total_amount").eq("merchant_id", merchant.id).eq("payment_status", "paid"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id).in("status", ["pending","accepted","preparing","assigned","rider_accepted","picked_up","on_delivery"]),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("is_active", true),
        supabase.from("riders").select("id", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("is_active", true),
        supabase.from("orders").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(5),
      ]);
      const revenue = (paidRes.data ?? []).reduce((a, r: any) => a + Number(r.total_amount || 0), 0);
      setStats({
        today: todayRes.count ?? 0, revenue, pending: pendRes.count ?? 0,
        products: prodRes.count ?? 0, riders: ridRes.count ?? 0,
      });
      setRecent(recentRes.data ?? []);
      const { data: low } = await supabase.from("products").select("*").eq("merchant_id", merchant.id).order("stock_qty");
      setLowStock((low ?? []).filter((p: any) => p.stock_qty <= p.low_stock_threshold).slice(0, 5));
    })();
  }, [merchant]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!merchant) return (
    <Card className="p-6 text-center">
      <h2 className="font-semibold">No merchant linked</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your account is not linked to a merchant yet. Please contact Gasbee admin.</p>
    </Card>
  );

  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{merchant.name}</h1>
        <p className="text-sm text-muted-foreground">{merchant.city ?? "—"} · ★ {Number(merchant.rating ?? 0).toFixed(1)} · status: {merchant.status}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Today's Orders" value={stats?.today ?? "—"} icon={ShoppingBag} />
        <Stat label="Revenue (paid)" value={stats ? fmt(stats.revenue) : "—"} icon={DollarSign} />
        <Stat label="Pending" value={stats?.pending ?? "—"} icon={Clock} />
        <Stat label="Products" value={stats?.products ?? "—"} icon={Package} />
        <Stat label="Active Riders" value={stats?.riders ?? "—"} icon={Bike} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent orders</h2><Link to="/merchant/orders" className="text-xs text-primary">View all</Link></div>
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
            <div className="space-y-2">
              {recent.map((o) => (
                <Link key={o.id} to={`/merchant/orders/${o.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent">
                  <div><div className="font-mono text-sm">{o.code}</div><div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div></div>
                  <div className="text-right"><div className="text-sm font-bold">{fmt(Number(o.total_amount))}</div><div className="text-xs capitalize text-muted-foreground">{o.status}</div></div>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Low stock</h2><Link to="/merchant/inventory" className="text-xs text-primary">Manage</Link></div>
          {lowStock.length === 0 ? <p className="text-sm text-muted-foreground">All stock healthy.</p> : (
            <div className="space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{p.name}</span>
                  <span className="text-sm font-semibold text-destructive">{p.stock_qty} left</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

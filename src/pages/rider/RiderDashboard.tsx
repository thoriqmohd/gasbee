import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { playBeep } from "@/lib/sound";

export default function RiderDashboard() {
  const { user } = useAuth();
  const [rider, setRider] = useState<any>(null);
  const [stats, setStats] = useState({ today: 0, earnings: 0, active: 0, available: 0 });
  const [jobs, setJobs] = useState<any[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const loadJobs = async (merchantId: string) => {
    const { data } = await supabase.from("orders").select("*").eq("merchant_id", merchantId).is("rider_id", null).in("status", ["accepted","preparing"]).order("created_at", { ascending: false });
    setJobs(data ?? []);
    (data ?? []).forEach((o: any) => seen.current.add(o.id));
  };

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
    await loadJobs(r.merchant_id);
  };
  useEffect(() => { load(); }, [user?.id]);

  // Live subscription to new orders for this merchant
  useEffect(() => {
    if (!rider?.merchant_id) return;
    const ch = supabase
      .channel(`rider-orders-${rider.merchant_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${rider.merchant_id}` }, (p) => {
        const o: any = p.new || p.old;
        if (!o) return;
        if (p.eventType === "INSERT" && !seen.current.has(o.id)) {
          seen.current.add(o.id);
          playBeep(4);
          toast.success(`🛵 New job ${o.code}`, { description: "A new order is ready to grab.", duration: 8000 });
        }
        loadJobs(rider.merchant_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rider?.merchant_id]);

  const toggleStatus = async (online: boolean) => {
    if (!rider) return;
    const status = online ? "online" : "offline";
    const { error } = await supabase.from("riders").update({ status }).eq("id", rider.id);
    if (error) toast.error(error.message); else { toast.success(online ? "Online" : "Offline"); load(); }
  };

  const licenseOk = rider?.license_image_url && (!rider?.license_expiry_date || new Date(rider.license_expiry_date) >= new Date());

  const accept = async (orderId: string) => {
    if (!rider) return;
    if (!licenseOk) { toast.error("Upload a valid driving license before accepting jobs."); return; }
    const { error } = await supabase.from("orders").update({ rider_id: rider.id, status: "rider_accepted" as any, assigned_at: new Date().toISOString() }).eq("id", orderId);
    if (error) toast.error(error.message); else { toast.success("Accepted"); load(); }
  };

  if (!rider) return <p className="text-sm text-muted-foreground">Rider profile not linked. Contact merchant.</p>;
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));

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

      <Button asChild variant="outline" className="w-full"><Link to="/merchant/rider/active-delivery">Active delivery</Link></Button>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">New jobs</h2>
        {rider && !licenseOk && (
          <Card className="border-destructive bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">License required</p>
            <p>{!rider.license_image_url ? "Your driving license has not been uploaded." : "Your driving license has expired."} Contact your merchant to update it.</p>
          </Card>
        )}
        {jobs.length === 0 && <p className="text-sm text-muted-foreground">No available jobs.</p>}
        {jobs.map((o) => (
          <Card key={o.id} className="space-y-2 p-4">
            <div className="flex justify-between"><span className="font-mono text-sm">{o.code}</span><span className="font-bold">{fmt(o.delivery_fee)}</span></div>
            <p className="text-sm">{o.address_snapshot?.address_line1}, {o.address_snapshot?.city}</p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1"><Link to={`/merchant/rider/jobs/${o.id}`}>Details</Link></Button>
              <Button size="sm" className="flex-1" onClick={() => accept(o.id)} disabled={!licenseOk}>Accept</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

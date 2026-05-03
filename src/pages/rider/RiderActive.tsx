import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Phone, Navigation } from "lucide-react";

const FLOW: Record<string, string> = {
  rider_accepted: "arrived_at_merchant",
  arrived_at_merchant: "picked_up",
  picked_up: "on_delivery",
  on_delivery: "arrived_at_customer",
  arrived_at_customer: "delivered",
};

export default function RiderActive() {
  const { user } = useAuth();
  const [rider, setRider] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const watchRef = useRef<number | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("riders").select("*").eq("user_id", user.id).maybeSingle();
    setRider(r);
    if (!r) return;
    const { data } = await supabase.from("orders").select("*").eq("rider_id", r.id).in("status", ["rider_accepted","arrived_at_merchant","picked_up","on_delivery","arrived_at_customer"]).order("created_at", { ascending: false });
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  // Track GPS while on active deliveries; push to riders.current_lat/lng
  useEffect(() => {
    if (!rider || orders.length === 0 || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("riders").update({ current_lat: pos.coords.latitude, current_lng: pos.coords.longitude, status: "on_delivery" as any }).eq("id", rider.id);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
    watchRef.current = id;
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [rider?.id, orders.length]);

  const advance = async (o: any) => {
    const next = FLOW[o.status];
    if (!next) return;
    const stamp: any = {};
    if (next === "picked_up") stamp.picked_up_at = new Date().toISOString();
    if (next === "delivered") stamp.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update({ status: next as any, ...stamp }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success(`Marked ${next.replace(/_/g," ")}`); load(); }
  };

  const dirLink = (o: any) => {
    const a = o.address_snapshot ?? {};
    if (a.latitude && a.longitude) return `https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.address_line1 ?? ""} ${a.city ?? ""}`)}`;
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1"><Link to={`/merchant/rider/jobs/${o.id}`}>Details / Chat</Link></Button>
            <Button asChild variant="outline" size="sm"><a href={dirLink(o)} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-3 w-3" />Navigate</a></Button>
            {o.address_snapshot?.recipient_phone && <Button asChild variant="outline" size="sm"><a href={`tel:${o.address_snapshot.recipient_phone}`}><Phone className="mr-1 h-3 w-3" />Call</a></Button>}
            {FLOW[o.status] && <Button size="sm" className="flex-1" onClick={() => advance(o)}>Mark {FLOW[o.status].replace(/_/g," ")}</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

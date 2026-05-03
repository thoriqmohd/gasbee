import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";
import { Phone, Navigation } from "lucide-react";
import { MapPicker } from "@/components/MapPicker";
import { OrderChat } from "@/components/OrderChat";

const STEPS = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

export default function UserOrderDetail() {
  const { id } = useParams();
  const [o, setO] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [riderLoc, setRiderLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: order } = await supabase.from("orders").select("*, merchants(name, phone, latitude, longitude), riders(id, full_name, phone, current_lat, current_lng, vehicle_type, vehicle_plate)").eq("id", id).maybeSingle();
      setO(order);
      if ((order as any)?.riders?.current_lat) {
        setRiderLoc({ lat: Number((order as any).riders.current_lat), lng: Number((order as any).riders.current_lng) });
      }
      const { data: oi } = await supabase.from("order_items").select("*").eq("order_id", id);
      setItems(oi ?? []);
    };
    load();
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Subscribe to rider location updates
  useEffect(() => {
    const riderId = (o as any)?.riders?.id;
    if (!riderId) return;
    const ch = supabase.channel(`rider-${riderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "riders", filter: `id=eq.${riderId}` }, (p: any) => {
        if (p.new?.current_lat) setRiderLoc({ lat: Number(p.new.current_lat), lng: Number(p.new.current_lng) });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [(o as any)?.riders?.id]);

  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const stepIdx = STEPS.indexOf(o.status);
  const cancel = async () => {
    const { error } = await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success("Cancelled"); setO({ ...o, status: "cancelled" }); }
  };

  const a = o.address_snapshot ?? {};
  const markers: any[] = [];
  if (a.latitude) markers.push({ lat: Number(a.latitude), lng: Number(a.longitude), label: "Delivery address" });
  if (o.merchants?.latitude) markers.push({ lat: Number(o.merchants.latitude), lng: Number(o.merchants.longitude), label: o.merchants.name });
  if (riderLoc) markers.push({ lat: riderLoc.lat, lng: riderLoc.lng, label: "Rider 🛵" });

  const trackable = ["rider_accepted","arrived_at_merchant","picked_up","on_delivery","arrived_at_customer","out_for_delivery"].includes(o.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{o.code}</h1>
        <StatusBadge value={o.status} />
      </div>

      {o.delivery_type === "scheduled" && o.scheduled_at && (
        <Card className="border-primary bg-primary/5 p-3 text-sm">
          📅 Scheduled delivery: <span className="font-semibold">{new Date(o.scheduled_at).toLocaleString()}</span>
        </Card>
      )}

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

      {trackable && markers.length > 0 && (
        <Card className="p-2">
          <div className="mb-1 px-2 pt-1 text-sm font-semibold">Live tracking</div>
          <MapPicker lat={riderLoc?.lat ?? (a.latitude ? Number(a.latitude) : null)} lng={riderLoc?.lng ?? (a.longitude ? Number(a.longitude) : null)} readOnly markers={markers} height={260} />
          {!riderLoc && o.riders && <p className="px-2 pb-1 pt-1 text-[11px] text-muted-foreground">Waiting for rider GPS…</p>}
        </Card>
      )}

      <Card className="space-y-1 p-3 text-sm">
        <div className="font-semibold">Merchant</div>
        <div>{o.merchants?.name}</div>
        {o.merchants?.phone && <div className="text-xs text-muted-foreground">{o.merchants.phone}</div>}
      </Card>

      {o.riders && (
        <Card className="space-y-2 p-3 text-sm">
          <div className="font-semibold">Rider</div>
          <div>{o.riders.full_name} {o.riders.vehicle_type && <span className="text-xs text-muted-foreground">· {o.riders.vehicle_type} {o.riders.vehicle_plate ?? ""}</span>}</div>
          <div className="text-xs text-muted-foreground">{o.riders.phone}</div>
          {o.riders.phone && (
            <Button asChild size="sm" className="w-full"><a href={`tel:${o.riders.phone}`}><Phone className="mr-1 h-3 w-3" />Call rider</a></Button>
          )}
        </Card>
      )}

      <Card className="p-3">
        <div className="mb-1 flex items-center justify-between text-sm font-semibold"><span>Delivery to</span>
          {a.latitude && (
            <a className="text-xs text-primary underline" href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer"><Navigation className="mr-1 inline h-3 w-3" />Open map</a>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {a.address_line1}, {a.postcode} {a.city}
        </div>
      </Card>

      {o.rider_id && <OrderChat orderId={o.id} senderRole="customer" />}

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

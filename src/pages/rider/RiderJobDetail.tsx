import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Navigation, MapPin } from "lucide-react";
import { toast } from "sonner";
import { MapPicker } from "@/components/MapPicker";
import { OrderChat } from "@/components/OrderChat";

export default function RiderJobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [o, setO] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("orders").select("*, merchants(name, latitude, longitude, address)").eq("id", id).maybeSingle();
    setO(data);
    setMerchant((data as any)?.merchants ?? null);
  };
  useEffect(() => { load(); }, [id]);

  const accept = async () => {
    const { data: r } = await supabase.from("riders").select("*").eq("user_id", user!.id).maybeSingle();
    if (!r) return;
    const licenseOk = r.license_image_url && (!r.license_expiry_date || new Date(r.license_expiry_date) >= new Date());
    if (!licenseOk) { toast.error("Upload a valid driving license before accepting jobs."); return; }
    const { error } = await supabase.from("orders").update({ rider_id: r.id, status: "rider_accepted" as any, assigned_at: new Date().toISOString() }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success("Accepted"); nav("/merchant/rider/active-delivery"); }
  };

  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  const a = o.address_snapshot ?? {};
  const dest = `${a.address_line1 ?? ""}, ${a.postcode ?? ""} ${a.city ?? ""}`.trim();
  const hasCoords = a.latitude != null && a.longitude != null;
  const gmaps = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
  const waze = hasCoords ? `https://waze.com/ul?ll=${a.latitude},${a.longitude}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(dest)}`;
  const phone = a.recipient_phone;

  const markers = [];
  if (merchant?.latitude) markers.push({ lat: Number(merchant.latitude), lng: Number(merchant.longitude), label: merchant.name + " (pickup)" });
  if (hasCoords) markers.push({ lat: Number(a.latitude), lng: Number(a.longitude), label: "Customer" });

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}>← Back</Button>
      <Card className="space-y-2 p-4">
        <p className="font-mono">{o.code}</p>
        <p className="font-bold">{a.recipient_name}</p>
        <p className="text-sm">{phone}</p>
        <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{dest}</p>
        {o.delivery_type === "scheduled" && o.scheduled_at && (
          <p className="text-sm font-semibold text-primary">Scheduled: {new Date(o.scheduled_at).toLocaleString()}</p>
        )}
        {o.notes && <p className="rounded bg-muted p-2 text-xs">📝 {o.notes}</p>}
        <div className="flex justify-between border-t pt-2"><span>Delivery fee</span><span className="font-bold">{fmt(o.delivery_fee)}</span></div>
        <div className="flex justify-between"><span>Total</span><span>{fmt(o.total_amount)}</span></div>
      </Card>

      {markers.length > 0 && (
        <Card className="p-2">
          <MapPicker lat={hasCoords ? Number(a.latitude) : null} lng={hasCoords ? Number(a.longitude) : null} readOnly markers={markers} height={240} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline"><a href={gmaps} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Google Maps</a></Button>
        <Button asChild variant="outline"><a href={waze} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Waze</a></Button>
      </div>
      {phone && (
        <Button asChild className="w-full"><a href={`tel:${phone}`}><Phone className="mr-1 h-4 w-4" />Call customer</a></Button>
      )}

      {o.rider_id && <OrderChat orderId={o.id} senderRole="rider" />}

      {!o.rider_id && <Button className="w-full" onClick={accept}>Accept job</Button>}
    </div>
  );
}

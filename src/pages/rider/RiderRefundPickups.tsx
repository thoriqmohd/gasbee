import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { Navigation, Phone, Undo2 } from "lucide-react";

export default function RiderRefundPickups() {
  const { user } = useAuth();
  const [rider, setRider] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [proofs, setProofs] = useState<Record<string, string | null>>({});

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("riders").select("*").eq("user_id", user.id).maybeSingle();
    setRider(r);
    if (!r) return;
    const { data } = await supabase.from("refunds").select("*, orders(code, address_snapshot, customer_id)")
      .eq("pickup_rider_id", r.id).in("pickup_status", ["pending", "picked_up"]).order("created_at", { ascending: false });
    setRows(data ?? []);
    const init: Record<string, string | null> = {};
    (data ?? []).forEach((x: any) => { init[x.id] = x.pickup_proof_url ?? null; });
    setProofs(init);
  };
  useEffect(() => { load(); }, [user?.id]);

  const markPickedUp = async (id: string) => {
    const proof = proofs[id];
    if (!proof) { toast.error("Upload gambar bukti pickup."); return; }
    const { error } = await supabase.from("refunds").update({
      pickup_status: "picked_up" as any,
      pickup_proof_url: proof,
      pickup_completed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Pickup diselesaikan"); load(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Undo2 className="h-5 w-5 text-primary" /><h1 className="text-xl font-bold">Refund pickups</h1></div>
      {!rider && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rider && rows.length === 0 && <p className="text-sm text-muted-foreground">Tiada pickup refund.</p>}
      {rows.map((r) => {
        const a = r.orders?.address_snapshot ?? {};
        const navUrl = a.latitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((a.address_line1 ?? "") + " " + (a.city ?? ""))}`;
        return (
          <Card key={r.id} className="space-y-2 p-4">
            <div className="flex justify-between text-sm"><span className="font-mono">{r.orders?.code}</span><span className="uppercase text-xs">{r.pickup_status.replace(/_/g, " ")}</span></div>
            <div className="rounded bg-amber-500/10 p-2 text-xs">
              <div className="font-semibold">Pickup balik tong gas dari customer</div>
              <div>{a.recipient_name} — {a.recipient_phone}</div>
              <div className="text-muted-foreground">{a.address_line1}, {a.city}</div>
              <div className="mt-1">Sebab: <span className="font-medium">{r.reason}</span></div>
            </div>

            {r.pickup_status === "pending" && (
              <div className="rounded border-2 border-dashed border-primary p-3">
                <p className="mb-2 text-sm font-semibold">Bukti pickup (wajib)</p>
                <ImageUpload bucket="delivery-proofs" pathPrefix={`refund-${r.id}`} value={proofs[r.id] ?? null} onChange={(url) => setProofs((p) => ({ ...p, [r.id]: url }))} label="Upload gambar" />
              </div>
            )}

            {r.pickup_status === "picked_up" && r.pickup_proof_url && (
              <div className="text-xs text-muted-foreground">✓ Pickup selesai pada {new Date(r.pickup_completed_at).toLocaleString()} — menunggu admin proses refund.</div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><a href={navUrl} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-3 w-3" />Navigate</a></Button>
              {a.recipient_phone && <Button asChild variant="outline" size="sm"><a href={`tel:${a.recipient_phone}`}><Phone className="mr-1 h-3 w-3" />Call</a></Button>}
              {r.pickup_status === "pending" && <Button size="sm" className="flex-1" onClick={() => markPickedUp(r.id)}>Tandai picked up</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

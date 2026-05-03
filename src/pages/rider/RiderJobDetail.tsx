import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RiderJobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [o, setO] = useState<any>(null);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    setO(data);
  };
  useEffect(() => { load(); }, [id]);

  const accept = async () => {
    const { data: r } = await supabase.from("riders").select("id").eq("user_id", user!.id).maybeSingle();
    if (!r) return;
    const { error } = await supabase.from("orders").update({ rider_id: r.id, status: "rider_accepted" as any, assigned_at: new Date().toISOString() }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success("Accepted"); nav("/merchant/rider/active-delivery"); }
  };

  if (!o) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}>← Back</Button>
      <Card className="space-y-2 p-4">
        <p className="font-mono">{o.code}</p>
        <p className="font-bold">{o.address_snapshot?.recipient_name}</p>
        <p className="text-sm">{o.address_snapshot?.recipient_phone}</p>
        <p className="text-sm text-muted-foreground">{o.address_snapshot?.address_line1}, {o.address_snapshot?.postcode} {o.address_snapshot?.city}</p>
        <div className="flex justify-between border-t pt-2"><span>Delivery fee</span><span className="font-bold">{fmt(o.delivery_fee)}</span></div>
        <div className="flex justify-between"><span>Total</span><span>{fmt(o.total_amount)}</span></div>
      </Card>
      {!o.rider_id && <Button className="w-full" onClick={accept}>Accept job</Button>}
    </div>
  );
}

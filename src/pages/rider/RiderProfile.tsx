import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RiderProfile() {
  const { user } = useAuth();
  const [r, setR] = useState<any>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("riders").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setR(data));
  }, [user?.id]);

  const save = async () => {
    if (!r) return;
    const { error } = await supabase.from("riders").update({ full_name: r.full_name, phone: r.phone, vehicle_type: r.vehicle_type, vehicle_plate: r.vehicle_plate, license_no: r.license_no }).eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  if (!r) return <p className="text-sm text-muted-foreground">No rider profile.</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Profile</h1>
      <Card className="space-y-3 p-4">
        <div><Label>Name</Label><Input value={r.full_name ?? ""} onChange={(e) => setR({ ...r, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={r.phone ?? ""} onChange={(e) => setR({ ...r, phone: e.target.value })} /></div>
        <div><Label>Vehicle type</Label><Input value={r.vehicle_type ?? ""} onChange={(e) => setR({ ...r, vehicle_type: e.target.value })} /></div>
        <div><Label>Plate</Label><Input value={r.vehicle_plate ?? ""} onChange={(e) => setR({ ...r, vehicle_plate: e.target.value })} /></div>
        <div><Label>License no</Label><Input value={r.license_no ?? ""} onChange={(e) => setR({ ...r, license_no: e.target.value })} /></div>
        <Button onClick={save} className="w-full">Save</Button>
      </Card>
      <Card className="p-4"><p className="text-sm text-muted-foreground">Rating</p><p className="text-2xl font-bold">{Number(r.rating || 0).toFixed(1)} ★</p></Card>
    </div>
  );
}

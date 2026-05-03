import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  vehicle_type: z.string().trim().max(50).optional(),
  vehicle_plate: z.string().trim().max(20).optional(),
  license_no: z.string().trim().max(50).optional(),
});

export default function MerchantRiders() {
  const { merchant } = useMerchantContext();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({ full_name: "", phone: "", email: "", password: "", vehicle_type: "motorcycle", vehicle_plate: "", license_no: "" });

  const load = () => merchant && supabase.from("riders").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, [merchant?.id]);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("merchant-create-rider", {
      body: parsed.data,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? "Failed"); return; }
    toast.success("Rider added");
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "", password: "", vehicle_type: "motorcycle", vehicle_plate: "", license_no: "" });
    load();
  };

  const toggle = async (r: any) => {
    const { error } = await supabase.from("riders").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else load();
  };
  const del = async (r: any) => {
    if (!confirm(`Remove rider ${r.full_name}?`)) return;
    const { error } = await supabase.from("riders").delete().eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  if (!merchant) return <p className="text-sm text-muted-foreground">No merchant linked.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Riders</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Register rider</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register new rider</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Vehicle</Label><Input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} /></div>
                <div><Label>Plate</Label><Input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} /></div>
              </div>
              <div><Label>License no.</Label><Input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">A login account will be created so the rider can sign in to the Gasbee Rider app.</p>
              <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create rider"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr className="text-left"><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Vehicle</th><th className="p-3">Status</th><th className="p-3">Deliveries</th><th className="p-3"></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b"><td className="p-3">{r.full_name}</td><td className="p-3">{r.phone}</td><td className="p-3">{r.vehicle_type ?? "—"} {r.vehicle_plate ?? ""}</td><td className="p-3"><StatusBadge value={r.status} /></td><td className="p-3">{r.total_deliveries}</td>
                <td className="p-3 text-right"><Button size="sm" variant={r.is_active ? "default" : "outline"} onClick={() => toggle(r)} className="mr-2">{r.is_active ? "Active" : "Inactive"}</Button><Button size="icon" variant="ghost" onClick={() => del(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No riders yet. Click "Register rider" to add one.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

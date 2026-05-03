import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  role: z.enum(["merchant_manager", "merchant_staff"]),
});

export default function MerchantStaff() {
  const { merchant } = useMerchantContext();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({ full_name: "", phone: "", email: "", password: "", role: "merchant_staff" });

  const load = async () => {
    if (!merchant) return;
    const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role, created_at").eq("merchant_id", merchant.id).in("role", ["merchant_owner","merchant_manager","merchant_staff"]);
    const ids = (rolesRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setItems([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
    const merged = (rolesRows ?? []).map((r) => ({ ...r, profile: profiles?.find((p) => p.id === r.user_id) }));
    setItems(merged);
  };
  useEffect(() => { load(); }, [merchant?.id]);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("merchant-create-staff", {
      body: parsed.data, headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? "Failed"); return; }
    toast.success("Staff added"); setOpen(false);
    setForm({ full_name: "", phone: "", email: "", password: "", role: "merchant_staff" });
    load();
  };

  const remove = async (row: any) => {
    if (!confirm(`Remove staff ${row.profile?.full_name ?? ""}?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("merchant_id", merchant!.id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  if (!merchant) return <p className="text-sm text-muted-foreground">No merchant linked.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add staff</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Role</Label>
                <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="merchant_staff">Staff</option>
                  <option value="merchant_manager">Manager</option>
                </select>
              </div>
              <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr className="text-left"><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Role</th><th className="p-3">Joined</th><th className="p-3"></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.user_id + r.role} className="border-b">
                <td className="p-3">{r.profile?.full_name ?? "—"}</td>
                <td className="p-3">{r.profile?.phone ?? "—"}</td>
                <td className="p-3 capitalize">{r.role.replace(/_/g, " ")}</td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">{r.role !== "merchant_owner" && <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No staff yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, RefreshCw } from "lucide-react";

const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
};

export default function Merchants() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = { name: "", slug: "", phone: "", email: "", password: genPassword(), address: "", city: "", state: "", postcode: "" };
  const [form, setForm] = useState(initial);

  const create = async () => {
    if (!form.name || !form.slug || !form.email || !form.password) {
      toast.error("Name, slug, email & password are required");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-merchant", { body: form });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success("Merchant created. Share login details with merchant.");
    setOpen(false);
    setForm({ ...initial, password: genPassword() });
    setTimeout(() => location.reload(), 300);
  };

  const copyCreds = async () => {
    await navigator.clipboard.writeText(`Login: /merchant/login\nEmail: ${form.email}\nPassword: ${form.password}`);
    toast.success("Login details copied");
  };

  return (
    <DataListPage
      title="Merchants" description="All gas dealers on Gasbee."
      table="merchants" searchField="name"
      orderBy={{ column: "created_at", ascending: false }}
      topAction={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm({ ...initial, password: genPassword() }); }}>
          <DialogTrigger asChild><Button>+ New merchant</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New merchant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Business name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} /></div>
                <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email (login) *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div>
                <Label>Password *</Label>
                <div className="flex gap-2">
                  <Input type={show ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, password: genPassword() })}><RefreshCw className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" onClick={copyCreds}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Pass these credentials to the merchant. They sign in at /merchant/login.</p>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
              </div>
              <Button onClick={create} disabled={busy} className="w-full">{busy ? "Creating…" : "Create merchant + owner login"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "city", label: "City" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "rating", label: "Rating", render: (r: any) => `★ ${Number(r.rating ?? 0).toFixed(1)}` },
        { key: "total_orders", label: "Orders" },
      ]}
    />
  );
}

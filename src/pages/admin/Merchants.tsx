import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, RefreshCw, Pencil } from "lucide-react";

const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
};

function EditMerchantDialog({ row, onDone }: { row: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [resetPwd, setResetPwd] = useState(false);
  const [form, setForm] = useState<any>({
    name: row.name ?? "", slug: row.slug ?? "", email: row.email ?? "", phone: row.phone ?? "",
    address: row.address ?? "", city: row.city ?? "", state: row.state ?? "", postcode: row.postcode ?? "",
    status: row.status ?? "active", commission_rate: row.commission_rate ?? 10,
  });
  const [password, setPassword] = useState(genPassword());
  const [newEmail, setNewEmail] = useState("");

  const save = async () => {
    setBusy(true);
    const body: any = { merchant_id: row.id, fields: form };
    if (resetPwd) body.new_password = password;
    if (newEmail && newEmail !== row.email) body.new_email = newEmail;
    const { data, error } = await supabase.functions.invoke("admin-update-merchant", { body });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? "Failed"); return; }
    toast.success("Merchant updated");
    setOpen(false);
    onDone();
  };

  const copyCreds = async () => {
    await navigator.clipboard.writeText(`Login: /merchant/login\nEmail: ${newEmail || form.email}\nPassword: ${password}`);
    toast.success("Login details copied");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="mr-1 h-3 w-3" />Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit merchant</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Business name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Contact email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Commission %</Label><Input type="number" step="0.01" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} /></div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-semibold">Owner login (auth)</p>
            <div><Label>Change login email (optional)</Label><Input type="email" placeholder="Leave blank to keep current" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resetPwd} onChange={(e) => setResetPwd(e.target.checked)} />
              Reset password
            </label>
            {resetPwd && (
              <div>
                <Label>New password</Label>
                <div className="flex gap-2">
                  <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(genPassword())}><RefreshCw className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" onClick={copyCreds}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Pass these credentials to the merchant.</p>
              </div>
            )}
            {!row.owner_id && <p className="text-xs text-destructive">No owner linked — email/password changes will be skipped.</p>}
          </div>

          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Merchants() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const initial = { name: "", slug: "", phone: "", email: "", password: genPassword(), address: "", city: "", state: "", postcode: "" };
  const [form, setForm] = useState(initial);

  const create = async () => {
    if (!form.name || !form.slug || !form.email || !form.password) { toast.error("Name, slug, email & password are required"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-merchant", { body: form });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? "Failed"); return; }
    toast.success("Merchant created. Share login details with merchant.");
    setOpen(false); setForm({ ...initial, password: genPassword() });
    setTimeout(() => location.reload(), 300);
  };

  const copyCreds = async () => {
    await navigator.clipboard.writeText(`Login: /merchant/login\nEmail: ${form.email}\nPassword: ${form.password}`);
    toast.success("Login details copied");
  };

  return (
    <DataListPage
      key={reloadKey}
      title="Merchants" description="All gas dealers on Gasbee."
      table="merchants" searchField="name"
      orderBy={{ column: "created_at", ascending: false }}
      rowAction={(r: any) => <EditMerchantDialog row={r} onDone={() => setReloadKey((k) => k + 1)} />}
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

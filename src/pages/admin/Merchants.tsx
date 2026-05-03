import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Merchants() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", phone: "", email: "", address: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { error } = await supabase.from("merchants").insert({ ...form, status: "active" as any });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Merchant created"); setOpen(false);
    setForm({ name: "", slug: "", phone: "", email: "", address: "" });
    setTimeout(() => location.reload(), 200);
  };

  return (
    <DataListPage
      title="Merchants" description="All gas dealers on Gasbee."
      table="merchants" searchField="name"
      orderBy={{ column: "created_at", ascending: false }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New merchant</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New merchant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")})} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e)=>setForm({...form, slug: e.target.value})} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e)=>setForm({...form, address: e.target.value})} /></div>
              <Button onClick={create} disabled={busy} className="w-full">{busy ? "Saving…" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "city", label: "City" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "rating", label: "Rating", render: (r: any) => `★ ${Number(r.rating ?? 0).toFixed(1)}` },
        { key: "total_orders", label: "Orders" },
      ]}
    />
  );
}

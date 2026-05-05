import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send } from "lucide-react";

const TARGETS = [
  { value: "all", label: "All users" },
  { value: "customer", label: "Customers" },
  { value: "merchant_owner", label: "Merchants (owners)" },
  { value: "merchant_rider", label: "Riders" },
];

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", target: "all", link: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("type", filter as any);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const send = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setBusy(true);
    let userIds: string[] = [];
    if (form.target === "all") {
      const { data } = await supabase.from("profiles").select("id").limit(5000);
      userIds = (data ?? []).map((u: any) => u.id);
    } else {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", form.target as any).limit(5000);
      userIds = Array.from(new Set((data ?? []).map((u: any) => u.user_id)));
    }
    if (userIds.length === 0) { setBusy(false); return toast.error("No recipients found"); }
    const payload = userIds.map((id) => ({
      user_id: id, title: form.title, body: form.body, type: "system" as any,
      link: form.link || null,
    }));
    // chunk insert
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from("notifications").insert(payload.slice(i, i + 500));
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false);
    toast.success(`Sent to ${userIds.length} users`);
    setOpen(false); setForm({ title: "", body: "", target: "all", link: "" }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">Send in-app notifications to users by role.</p></div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Send className="mr-1 h-4 w-4" />Send notification</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send notification</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Send to *</Label>
                  <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Body</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                <div><Label>Link (optional)</Label><Input placeholder="/user/orders" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
                <Button className="w-full" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</Button>
                <p className="text-xs text-muted-foreground">In-app notifications will appear in users' bell icon. Push to device coming later.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Title</th><th className="p-3">Body</th><th className="p-3">Type</th>
            <th className="p-3">Read</th><th className="p-3">Sent</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.title}</td>
                <td className="p-3 max-w-md truncate text-muted-foreground">{r.body}</td>
                <td className="p-3 capitalize">{r.type}</td>
                <td className="p-3">{r.is_read ? "Yes" : "No"}</td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No notifications.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

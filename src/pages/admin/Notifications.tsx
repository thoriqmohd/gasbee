import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", target: "all" });
  const send = async () => {
    const { data: users } = await supabase.from("profiles").select("id").limit(1000);
    if (!users) return;
    const rows = users.map((u: any) => ({ user_id: u.id, title: form.title, body: form.body, type: "system" as const }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${rows.length} users`); setOpen(false);
    setTimeout(()=>location.reload(),200);
  };
  return (
    <DataListPage
      title="Notifications" description="Send and view system notifications." table="notifications"
      orderBy={{ column: "created_at", ascending: false }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Send notification</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Send notification</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} /></div>
              <div><Label>Body</Label><Textarea value={form.body} onChange={(e)=>setForm({...form, body: e.target.value})} /></div>
              <Button className="w-full" onClick={send}>Send to all users</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "title", label: "Title" },
        { key: "type", label: "Type" },
        { key: "is_read", label: "Read", render: (r: any) => r.is_read ? "Yes" : "No" },
        { key: "created_at", label: "Sent", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function UserSupport() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });

  const load = () => {
    if (!user) return;
    supabase.from("support_tickets").select("*").eq("opened_by", user.id).order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  };
  useEffect(load, [user]);

  const create = async () => {
    if (!form.subject.trim()) { toast.error("Subject required"); return; }
    const { error } = await supabase.from("support_tickets").insert({
      opened_by: user!.id, subject: form.subject.trim().slice(0, 200), body: form.body.trim().slice(0, 2000), context_role: "customer",
    });
    if (error) toast.error(error.message); else { toast.success("Ticket created"); setOpen(false); setForm({ subject: "", body: "" }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Support</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} /></div>
              <div><Label>Description</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} rows={5} /></div>
              <Button onClick={create} className="w-full">Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {items.map((t) => (
        <Card key={t.id} className="space-y-1 p-3">
          <div className="flex items-center justify-between"><div className="text-sm font-semibold">{t.subject}</div><StatusBadge value={t.status} /></div>
          {t.body && <div className="text-xs text-muted-foreground line-clamp-2">{t.body}</div>}
          <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet.</p>}
    </div>
  );
}

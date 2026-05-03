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
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";

export default function MerchantSupport() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const load = () => user && supabase.from("support_tickets").select("*").eq("opened_by", user.id).order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, [user?.id]);

  const submit = async () => {
    if (!form.subject.trim()) { toast.error("Subject required"); return; }
    const { error } = await supabase.from("support_tickets").insert({ opened_by: user!.id, subject: form.subject.slice(0, 200), body: form.body.slice(0, 2000), context_role: "merchant" });
    if (error) toast.error(error.message); else { toast.success("Ticket created"); setOpen(false); setForm({ subject: "", body: "" }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New ticket</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} /></div>
              <div><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} /></div>
              <Button className="w-full" onClick={submit}>Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {items.map((t) => (
          <Card key={t.id} className="p-3"><div className="flex items-center justify-between"><div className="font-semibold">{t.subject}</div><StatusBadge value={t.status} /></div>{t.body && <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.body}</div>}<div className="mt-1 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div></Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
      </div>
    </div>
  );
}

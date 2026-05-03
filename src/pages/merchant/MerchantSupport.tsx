import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";

export default function MerchantSupport() {
  const { user } = useAuth();
  const { merchant } = useMerchantContext();
  const [tab, setTab] = useState<"incoming" | "mine">("incoming");
  const [incoming, setIncoming] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const [reply, setReply] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    if (merchant) {
      const { data } = await supabase.from("support_tickets").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false });
      setIncoming(data ?? []);
    }
    const { data: m } = await supabase.from("support_tickets").select("*").eq("opened_by", user.id).order("created_at", { ascending: false });
    setMine(m ?? []);
  };
  useEffect(() => { load(); }, [user?.id, merchant?.id]);

  const submit = async () => {
    if (!form.subject.trim()) { toast.error("Subject required"); return; }
    const { error } = await supabase.from("support_tickets").insert({ opened_by: user!.id, subject: form.subject.slice(0, 200), body: form.body.slice(0, 2000), context_role: "merchant" });
    if (error) toast.error(error.message); else { toast.success("Ticket sent"); setOpen(false); setForm({ subject: "", body: "" }); load(); }
  };

  const updateStatus = async (t: any, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status: status as any }).eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const items = tab === "incoming" ? incoming : mine;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New ticket to Gasbee</Button></DialogTrigger>
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="incoming">Customer tickets {incoming.length > 0 && `(${incoming.length})`}</TabsTrigger>
          <TabsTrigger value="mine">My tickets to Gasbee</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {items.map((t) => (
          <Card key={t.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.subject}</div>
              <StatusBadge value={t.status} />
            </div>
            {t.body && <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</div>}
            <div className="mt-1 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
            {tab === "incoming" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setReply(t)}>Open</Button>
                {t.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => updateStatus(t, "in_progress")}>Mark in progress</Button>}
                {t.status !== "resolved" && <Button size="sm" onClick={() => updateStatus(t, "resolved")}>Resolve</Button>}
              </div>
            )}
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
      </div>

      {reply && <ReplyDialog ticket={reply} onClose={() => { setReply(null); load(); }} />}
    </div>
  );
}

function ReplyDialog({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const load = () => supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at").then(({ data }) => setMsgs(data ?? []));
  useEffect(() => { load(); }, [ticket.id]);

  const send = async () => {
    if (!body.trim()) return;
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, sender_id: user!.id, body: body.slice(0, 2000) });
    if (error) toast.error(error.message); else { setBody(""); load(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{ticket.subject}</DialogTitle></DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
          <div className="rounded bg-muted p-2 text-sm"><div className="text-xs text-muted-foreground">Customer</div>{ticket.body || "—"}</div>
          {msgs.map((m) => (
            <div key={m.id} className={`rounded p-2 text-sm ${m.sender_id === user?.id ? "bg-primary/10" : "bg-muted"}`}>
              <div className="text-xs text-muted-foreground">{m.sender_id === user?.id ? "You" : "Customer"} · {new Date(m.created_at).toLocaleString()}</div>
              {m.body}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply…" rows={3} maxLength={2000} />
          <Button onClick={send} className="w-full">Send reply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

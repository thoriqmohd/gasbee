import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface Props { orderId: string; senderRole: "customer" | "rider" | "merchant"; }

const QUICK = {
  rider: ["Saya dalam perjalanan", "Saya dah sampai", "Tak jumpa rumah, boleh pin lokasi?", "Hujan lebat, mungkin lambat sikit", "Gas habis, kena patah balik", "Boleh call saya?"],
  customer: ["Sila gunakan pintu belakang", "Saya akan keluar jumpa awak", "Tolong call bila sampai", "Letak depan pintu sahaja"],
  merchant: ["Pesanan sedang disediakan", "Rider akan keluar sekejap lagi", "Maaf atas kelewatan"],
};

export function OrderChat({ orderId, senderRole }: Props) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at").then(({ data }) => setMsgs(data ?? []));
    const ch = supabase.channel(`om-${orderId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` }, (p) => setMsgs((m) => [...m, p.new])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async (body: string) => {
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("order_messages").insert({ order_id: orderId, sender_id: user.id, sender_role: senderRole, body: body.trim() });
    if (error) toast.error(error.message); else setText("");
  };

  return (
    <Card className="space-y-2 p-3">
      <div className="text-sm font-semibold">Chat</div>
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {msgs.length === 0 && <p className="text-xs text-muted-foreground">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <div className="text-[10px] opacity-70">{m.sender_role}</div>
              <div>{m.body}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex flex-wrap gap-1">
        {(QUICK[senderRole] ?? []).map((q) => (
          <Button key={q} type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => send(q)}>{q}</Button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={500} />
        <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}

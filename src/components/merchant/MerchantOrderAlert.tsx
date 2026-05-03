import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { playBeep } from "@/lib/sound";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

export function MerchantOrderAlert() {
  const { merchant } = useMerchantContext();
  const [order, setOrder] = useState<any>(null);
  const seen = useRef<Set<string>>(new Set());
  const nav = useNavigate();

  useEffect(() => {
    if (!merchant) return;
    const channel = supabase
      .channel(`mo-${merchant.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `merchant_id=eq.${merchant.id}` }, (payload) => {
        const o: any = payload.new;
        if (seen.current.has(o.id)) return;
        seen.current.add(o.id);
        playBeep(4);
        setOrder(o);
        toast.success(`🛎️ New order ${o.code}`, { duration: 8000 });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchant?.id]);

  if (!order) return null;
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && setOrder(null)}>
      <DialogContent className="border-primary">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-6 w-6 animate-pulse text-primary" />
            New order received!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="rounded-lg bg-accent p-4">
            <p className="font-mono text-lg font-bold">{order.code}</p>
            <p className="text-sm">{order.address_snapshot?.recipient_name} · {order.address_snapshot?.recipient_phone}</p>
            <p className="text-sm text-muted-foreground">{order.address_snapshot?.address_line1}, {order.address_snapshot?.city}</p>
            <p className="mt-2 text-2xl font-bold text-primary">{fmt(order.total_amount)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOrder(null)}>Dismiss</Button>
          <Button onClick={() => { nav(`/merchant/orders/${order.id}`); setOrder(null); }}>Open order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

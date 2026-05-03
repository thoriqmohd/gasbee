import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";

export default function MerchantInventoryMovements() {
  const { merchant } = useMerchantContext();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!merchant) return;
    supabase.from("inventory_movements").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(100).then(({ data }) => setItems(data ?? []));
  }, [merchant?.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventory Movements</h1>
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Qty</th><th className="p-3">Reason</th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b"><td className="p-3 text-xs">{new Date(m.created_at).toLocaleString()}</td><td className="p-3 capitalize">{m.type.replace("_", " ")}</td><td className="p-3 font-bold">{m.quantity}</td><td className="p-3 text-muted-foreground">{m.reason ?? "—"}</td></tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No movements yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

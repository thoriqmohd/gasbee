import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";

const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n || 0));

export default function MerchantRefunds() {
  const { user } = useAuth();
  const { merchant } = useMerchantContext();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    if (!merchant) return;
    const { data: orders } = await supabase.from("orders").select("id,code").eq("merchant_id", merchant.id);
    const ids = (orders ?? []).map((o: any) => o.id);
    if (ids.length === 0) { setRows([]); return; }
    const codeMap: Record<string, string> = {};
    (orders ?? []).forEach((o: any) => { codeMap[o.id] = o.code; });
    const { data } = await supabase.from("refunds").select("*").in("order_id", ids).order("created_at", { ascending: false });
    setRows((data ?? []).map((r: any) => ({ ...r, order_code: codeMap[r.order_id] })));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [merchant?.id]);

  const acknowledge = async (id: string) => {
    const { error } = await supabase.from("refunds").update({
      merchant_acknowledged_at: new Date().toISOString(),
      merchant_acknowledged_by: user!.id,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acknowledged. Admin akan proses payout."); load();
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Refunds</h1><p className="text-sm text-muted-foreground">Refund requests from your customers.</p></div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Reason</th>
            <th className="p-3">Status</th><th className="p-3">Requested</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono text-xs">{r.order_code}</td>
                <td className="p-3 font-semibold">{fmt(r.amount)}</td>
                <td className="p-3">{r.reason}</td>
                <td className="p-3"><StatusBadge value={r.status} /></td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  {r.status === "approved" && !r.merchant_acknowledged_at && (
                    <Button size="sm" onClick={() => acknowledge(r.id)}>Acknowledge</Button>
                  )}
                  {r.merchant_acknowledged_at && <span className="text-xs text-muted-foreground">✓ Acknowledged</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No refund requests.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const TABS: any[] = [
  { value: "all", label: "All", filter: null },
  { value: "pending", label: "Pending", filter: ["pending"] },
  { value: "active", label: "Active", filter: ["confirmed","preparing","out_for_delivery"] },
  { value: "delivered", label: "Delivered", filter: ["delivered"] },
  { value: "cancelled", label: "Cancelled", filter: ["cancelled"] },
];

export default function MerchantOrders() {
  const { merchant } = useMerchantContext();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!merchant) return;
    let query = supabase.from("orders").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false });
    const t = TABS.find((x) => x.value === tab);
    if (t?.filter) query = query.in("status", t.filter);
    const { data } = await query.limit(200);
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [merchant?.id, tab]);

  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  const filtered = items.filter((o) => o.code?.toLowerCase().includes(q.toLowerCase()));

  if (!merchant) return <p className="text-sm text-muted-foreground">No merchant linked.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <Tabs value={tab} onValueChange={setTab}><TabsList>{TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList></Tabs>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code" className="max-w-sm" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40"><tr className="text-left">
              <th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Created</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="p-3 font-mono">{o.code}</td>
                  <td className="p-3"><StatusBadge value={o.status} /></td>
                  <td className="p-3"><StatusBadge value={o.payment_status} /></td>
                  <td className="p-3 font-semibold">{fmt(o.total_amount)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="p-3"><Button asChild size="sm" variant="outline"><Link to={`/merchant/orders/${o.id}`}>View</Link></Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

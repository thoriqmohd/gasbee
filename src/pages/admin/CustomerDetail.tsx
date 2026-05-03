import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, spent: 0 });

  useEffect(() => {
    if (!id) return;
    supabase.from("profiles").select("*").eq("id", id).maybeSingle().then(({ data }) => setP(data));
    supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(200).then(({ data }) => {
      const list = data ?? [];
      setOrders(list);
      setStats({ total: list.length, spent: list.filter((o: any) => o.payment_status === "paid").reduce((a: number, o: any) => a + Number(o.total_amount || 0), 0) });
    });
  }, [id]);

  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  if (!p) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}>← Back</Button>
      <div className="flex items-center gap-4">
        {p.avatar_url ? <img src={p.avatar_url} className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-muted" />}
        <div>
          <h1 className="text-2xl font-bold">{p.full_name ?? "Customer"}</h1>
          <p className="text-sm text-muted-foreground">{p.phone ?? "—"} · joined {new Date(p.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Total orders</p><p className="text-2xl font-bold">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Total spent (paid)</p><p className="text-2xl font-bold">{fmt(stats.spent)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Status</p><div className="mt-2"><StatusBadge value={p.is_active ? "active" : "inactive"} /></div></Card>
      </div>

      <Card>
        <div className="border-b p-3 font-semibold">Order history</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground"><th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Date</th><th className="p-3"></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-mono">{o.code}</td>
                <td className="p-3"><StatusBadge value={o.status} /></td>
                <td className="p-3"><StatusBadge value={o.payment_status} /></td>
                <td className="p-3 font-semibold">{fmt(o.total_amount)}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link to={`/orders/${o.id}`}>View</Link></Button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No orders.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

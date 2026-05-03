import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";

export default function MerchantReports() {
  const { merchant } = useMerchantContext();
  const [data, setData] = useState<any>({ today: 0, week: 0, month: 0, totalRevenue: 0, byStatus: {} as any });

  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const now = new Date();
      const today = new Date(now); today.setHours(0,0,0,0);
      const week = new Date(now); week.setDate(week.getDate() - 7);
      const month = new Date(now); month.setDate(month.getDate() - 30);
      const { data: orders } = await supabase.from("orders").select("status, total_amount, payment_status, created_at").eq("merchant_id", merchant.id);
      const list = orders ?? [];
      const sum = (arr: any[]) => arr.reduce((a, r) => a + Number(r.total_amount || 0), 0);
      const paid = list.filter((o) => o.payment_status === "paid");
      const byStatus: any = {};
      list.forEach((o: any) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });
      setData({
        today: list.filter((o) => new Date(o.created_at) >= today).length,
        week: list.filter((o) => new Date(o.created_at) >= week).length,
        month: list.filter((o) => new Date(o.created_at) >= month).length,
        totalRevenue: sum(paid),
        byStatus,
      });
    })();
  }, [merchant?.id]);

  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Today</div><div className="mt-1 text-2xl font-bold">{data.today}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Last 7 days</div><div className="mt-1 text-2xl font-bold">{data.week}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Last 30 days</div><div className="mt-1 text-2xl font-bold">{data.month}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Revenue (paid)</div><div className="mt-1 text-2xl font-bold">{fmt(data.totalRevenue)}</div></Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Orders by status</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(data.byStatus).map(([k, v]: any) => (
            <div key={k} className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">{k.replace(/_/g, " ")}</div><div className="mt-1 text-xl font-bold">{v}</div></div>
          ))}
          {Object.keys(data.byStatus).length === 0 && <p className="col-span-4 text-sm text-muted-foreground">No data.</p>}
        </div>
      </Card>
    </div>
  );
}

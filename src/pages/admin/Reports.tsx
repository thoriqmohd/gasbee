import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export default function Reports() {
  const [data, setData] = useState({ revenue: 0, orders: 0, avg: 0, refunded: 0 });
  useEffect(() => {
    (async () => {
      const { data: paid } = await supabase.from("orders").select("total_amount").eq("payment_status", "paid");
      const { data: ref } = await supabase.from("orders").select("total_amount").eq("payment_status", "refunded");
      const revenue = (paid ?? []).reduce((a, r: any) => a + Number(r.total_amount || 0), 0);
      const refunded = (ref ?? []).reduce((a, r: any) => a + Number(r.total_amount || 0), 0);
      const orders = (paid ?? []).length;
      setData({ revenue, orders, avg: orders ? revenue / orders : 0, refunded });
    })();
  }, []);
  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground">Sales summary.</p></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { l: "Total Revenue", v: fmt(data.revenue) },
          { l: "Paid Orders", v: data.orders },
          { l: "Avg Order Value", v: fmt(data.avg) },
          { l: "Refunded", v: fmt(data.refunded) },
        ].map((s) => (
          <Card key={s.l} className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-2xl font-bold">{s.v}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

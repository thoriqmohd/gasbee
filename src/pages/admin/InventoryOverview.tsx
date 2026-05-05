import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryOverview() {
  const [rows, setRows] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [merchantMap, setMerchantMap] = useState<Record<string, string>>({});
  const [merchantId, setMerchantId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("merchants").select("id,name").order("name").then(({ data }) => {
      setMerchants(data ?? []);
      const m: Record<string, string> = {};
      (data ?? []).forEach((x: any) => { m[x.id] = x.name; });
      setMerchantMap(m);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*").order("stock_qty", { ascending: true }).limit(300);
    if (merchantId !== "all") query = query.eq("merchant_id", merchantId);
    if (q) query = query.ilike("name", `%${q}%`);
    const { data } = await query;
    setRows(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [merchantId, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Inventory Overview</h1><p className="text-sm text-muted-foreground">Stock levels across all merchants.</p></div>
        <div className="flex items-center gap-2">
          <Select value={merchantId} onValueChange={setMerchantId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filter by merchant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All merchants</SelectItem>
              {merchants.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Product</th><th className="p-3">Merchant</th><th className="p-3">On hand</th>
            <th className="p-3">Reserved</th><th className="p-3">Low threshold</th><th className="p-3">Alert</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t"><td colSpan={6} className="p-3"><Skeleton className="h-5 w-full" /></td></tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No products.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{merchantMap[r.merchant_id] ?? "—"}</td>
                <td className="p-3">{r.stock_qty}</td>
                <td className="p-3">{r.reserved_qty}</td>
                <td className="p-3">{r.low_stock_threshold}</td>
                <td className="p-3">{r.stock_qty <= r.low_stock_threshold ? <span className="font-medium text-destructive">Low stock</span> : "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

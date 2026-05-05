import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function MerchantReports() {
  const { merchant } = useMerchantContext();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [orders, setOrders] = useState<any[]>([]);

  const load = async () => {
    if (!merchant) return;
    const start = new Date(from + "T00:00:00").toISOString();
    const end = new Date(to + "T23:59:59").toISOString();
    const { data } = await supabase.from("orders").select("*").eq("merchant_id", merchant.id).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false });
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, [merchant?.id, from, to]);

  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  const paid = orders.filter((o) => o.payment_status === "paid");
  const revenue = paid.reduce((a, r) => a + Number(r.total_amount || 0), 0);
  const byStatus: any = {};
  orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`${merchant?.name ?? ""} — Report`, 14, 16);
    doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, 14, 24);
    doc.text(`Total orders: ${orders.length} · Paid: ${paid.length} · Revenue: ${fmt(revenue)}`, 14, 30);
    autoTable(doc, {
      startY: 38,
      head: [["Code", "Date", "Status", "Payment", "Total"]],
      body: orders.map((o) => [o.code, new Date(o.created_at).toLocaleString(), o.status, o.payment_status, fmt(Number(o.total_amount))]),
    });
    doc.save(`merchant-report-${from}-to-${to}.pdf`);
  };
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Metric: "Period", Value: `${from} to ${to}` },
      { Metric: "Total Orders", Value: orders.length },
      { Metric: "Paid Orders", Value: paid.length },
      { Metric: "Revenue (MYR)", Value: revenue },
    ]), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orders.map((o) => ({
      Code: o.code, Date: new Date(o.created_at).toLocaleString(), Status: o.status, Payment: o.payment_status, Total: Number(o.total_amount),
    }))), "Orders");
    XLSX.writeFile(wb, `merchant-report-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={exportPDF}><Download className="mr-1 h-4 w-4" />PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total orders</div><div className="mt-1 text-2xl font-bold">{orders.length}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Paid</div><div className="mt-1 text-2xl font-bold">{paid.length}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Revenue</div><div className="mt-1 text-2xl font-bold">{fmt(revenue)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Avg order</div><div className="mt-1 text-2xl font-bold">{fmt(paid.length ? revenue/paid.length : 0)}</div></Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Orders by status</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(byStatus).map(([k, v]: any) => (
            <div key={k} className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">{k.replace(/_/g, " ")}</div><div className="mt-1 text-xl font-bold">{v}</div></div>
          ))}
          {Object.keys(byStatus).length === 0 && <p className="col-span-4 text-sm text-muted-foreground">No data.</p>}
        </div>
      </Card>
    </div>
  );
}

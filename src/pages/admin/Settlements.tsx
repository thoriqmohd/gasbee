import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
export default function Settlements() {
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  return (
    <DataListPage
      title="Settlements" description="Merchant payouts." table="settlements"
      orderBy={{ column: "period_end", ascending: false }}
      columns={[
        { key: "period_start", label: "From" },
        { key: "period_end", label: "To" },
        { key: "gross_sales", label: "Gross", render: (r: any) => fmt(r.gross_sales) },
        { key: "commission_amount", label: "Commission", render: (r: any) => fmt(r.commission_amount) },
        { key: "net_payout", label: "Net", render: (r: any) => fmt(r.net_payout) },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
      ]}
    />
  );
}

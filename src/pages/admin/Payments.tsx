import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
export default function Payments() {
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  return (
    <DataListPage
      title="Payments" description="All payment transactions."
      table="payments" orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "gateway", label: "Gateway" },
        { key: "gateway_ref", label: "Reference" },
        { key: "amount", label: "Amount", render: (r: any) => fmt(r.amount) },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

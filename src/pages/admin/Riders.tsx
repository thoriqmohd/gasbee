import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
export default function Riders() {
  return (
    <DataListPage
      title="Riders" description="All delivery riders."
      table="riders" searchField="full_name"
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "full_name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "vehicle_plate", label: "Vehicle" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "rating", label: "Rating", render: (r: any) => `★ ${Number(r.rating ?? 0).toFixed(1)}` },
        { key: "total_deliveries", label: "Deliveries" },
      ]}
    />
  );
}

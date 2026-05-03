import { DataListPage } from "@/components/admin/DataListPage";
export default function Customers() {
  return (
    <DataListPage
      title="Customers" description="All registered buyers."
      table="profiles" searchField="full_name"
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "full_name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "Yes" : "No" },
        { key: "created_at", label: "Joined", render: (r: any) => new Date(r.created_at).toLocaleDateString() },
      ]}
    />
  );
}

import { DataListPage } from "@/components/admin/DataListPage";
export default function Products() {
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  return (
    <DataListPage
      title="Products" description="All products from all merchants."
      table="products" searchField="name"
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "name", label: "Name" },
        { key: "cylinder_size_kg", label: "Size (kg)" },
        { key: "selling_price", label: "Price", render: (r: any) => fmt(r.selling_price) },
        { key: "stock_qty", label: "Stock" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "Yes" : "No" },
      ]}
    />
  );
}

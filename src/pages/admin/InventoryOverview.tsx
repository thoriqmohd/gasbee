import { DataListPage } from "@/components/admin/DataListPage";
export default function InventoryOverview() {
  return (
    <DataListPage
      title="Inventory Overview" description="Stock levels across all merchants."
      table="products" searchField="name"
      orderBy={{ column: "stock_qty", ascending: true }}
      columns={[
        { key: "name", label: "Product" },
        { key: "stock_qty", label: "On hand" },
        { key: "reserved_qty", label: "Reserved" },
        { key: "low_stock_threshold", label: "Low threshold" },
        { key: "alert", label: "Alert", render: (r: any) => r.stock_qty <= r.low_stock_threshold ? <span className="text-destructive font-medium">Low stock</span> : "OK" },
      ]}
    />
  );
}

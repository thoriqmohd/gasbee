import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type OrderRow = Pick<Tables<"orders">, "id" | "code" | "customer_id" | "status" | "payment_status" | "total_amount" | "created_at"> & {
  merchants: { name: string } | null;
  customerName?: string;
};

async function loadCustomerNames(orders: OrderRow[]): Promise<OrderRow[]> {
  const customerIds = [...new Set(orders.map((order) => order.customer_id))];
  const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", customerIds);
  if (error) throw new Error("Customer names could not be loaded.");

  const names = new Map((data ?? []).map((profile) => [profile.id, profile.full_name?.trim()]));
  return orders.map((order) => ({ ...order, customerName: names.get(order.customer_id) }));
}

export default function Orders() {
  const nav = useNavigate();
  const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n || 0));
  return (
    <DataListPage<OrderRow>
      title="Orders" description="All customer orders across merchants."
      table="orders" searchField="code"
      selectQuery="id,code,customer_id,status,payment_status,total_amount,created_at,merchants(name)"
      enrichRows={loadCustomerNames}
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "code", label: "Code", render: (r) => <span className="font-mono">{r.code}</span> },
        { key: "merchant", label: "Merchant", render: (r) => r.merchants?.name ?? "—" },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
        { key: "payment_status", label: "Payment", render: (r) => <StatusBadge value={r.payment_status} /> },
        { key: "total_amount", label: "Total", render: (r) => fmt(r.total_amount) },
        { key: "customerName", label: "Customer", render: (r) => r.customerName || "—" },
        { key: "created_at", label: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
      ]}
      rowAction={(r) => <Button size="sm" variant="outline" onClick={() => nav(`/orders/${r.id}`)}>View</Button>}
    />
  );
}

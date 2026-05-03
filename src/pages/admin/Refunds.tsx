import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Refunds() {
  const decide = async (id: string, status: "approved"|"rejected"|"processed") => {
    const { error } = await supabase.from("refunds").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); setTimeout(()=>location.reload(),200);
  };
  const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n||0));
  return (
    <DataListPage
      title="Refunds" description="Customer refund requests."
      table="refunds" orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "amount", label: "Amount", render: (r: any) => fmt(r.amount) },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "created_at", label: "Requested", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      rowAction={(r: any) => r.status === "requested" ? (
        <div className="flex gap-2 justify-end">
          <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
        </div>
      ) : r.status === "approved" ? (
        <Button size="sm" onClick={() => decide(r.id, "processed")}>Mark processed</Button>
      ) : null}
    />
  );
}

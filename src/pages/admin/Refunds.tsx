import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const fmt = (n: any) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n || 0));

function RefundDetails({ row }: { row: any }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);
  useEffect(() => {
    if (!open || !row.order_id) return;
    supabase.from("orders").select("code,total_amount,merchant_id,customer_id,status,payment_status").eq("id", row.order_id).maybeSingle().then(({ data }) => setOrder(data));
  }, [open, row.order_id]);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Details</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Refund details</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Order:</span> <span className="font-mono">{order?.code ?? row.order_id}</span></div>
            <div><span className="text-muted-foreground">Amount:</span> <strong>{fmt(row.amount)}</strong></div>
            <div><span className="text-muted-foreground">Reason:</span> {row.reason}</div>
            {row.notes && <div><span className="text-muted-foreground">Notes:</span> {row.notes}</div>}
            <div><span className="text-muted-foreground">Status:</span> <StatusBadge value={row.status} /></div>
            <div><span className="text-muted-foreground">Requested:</span> {new Date(row.created_at).toLocaleString()}</div>
            {row.merchant_acknowledged_at && (
              <div className="rounded bg-muted p-2 text-xs">✓ Merchant acknowledged on {new Date(row.merchant_acknowledged_at).toLocaleString()}</div>
            )}
            {row.status === "approved" && !row.merchant_acknowledged_at && (
              <div className="rounded bg-yellow-500/10 p-2 text-xs">⏳ Awaiting merchant acknowledgement</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Refunds() {
  const decide = async (id: string, status: "approved" | "rejected" | "processed") => {
    const { error } = await supabase.from("refunds").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "approved") {
      // notify merchant
      const { data: refund } = await supabase.from("refunds").select("order_id,amount").eq("id", id).maybeSingle();
      if (refund?.order_id) {
        const { data: order } = await supabase.from("orders").select("merchant_id,code").eq("id", refund.order_id).maybeSingle();
        if (order?.merchant_id) {
          const { data: ms } = await supabase.from("merchants").select("owner_id").eq("id", order.merchant_id).maybeSingle();
          if (ms?.owner_id) {
            await supabase.from("notifications").insert({
              user_id: ms.owner_id, type: "system" as any,
              title: "Refund approved — please acknowledge",
              body: `Order ${order.code}: refund of ${fmt(refund.amount)} approved by admin.`,
              link: "/merchant/refunds",
            });
          }
        }
      }
    }
    toast.success("Updated"); setTimeout(() => location.reload(), 200);
  };

  return (
    <DataListPage
      title="Refunds" description="Customer refund requests."
      table="refunds" orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "amount", label: "Amount", render: (r: any) => fmt(r.amount) },
        { key: "reason", label: "Reason" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "ack", label: "Merchant ack", render: (r: any) => r.merchant_acknowledged_at ? "✓" : (r.status === "approved" ? "Pending" : "—") },
        { key: "created_at", label: "Requested", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      rowAction={(r: any) => (
        <div className="flex justify-end gap-2">
          <RefundDetails row={r} />
          {r.status === "requested" && <>
            <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
          </>}
          {r.status === "approved" && r.merchant_acknowledged_at && (
            <Button size="sm" onClick={() => decide(r.id, "processed")}>Mark processed</Button>
          )}
        </div>
      )}
    />
  );
}

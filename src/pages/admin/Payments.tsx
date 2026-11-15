import { useState } from "react";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { getGasbeePaymentSource } from "../../../supabase/functions/_shared/gasbee-payment-source";

type Payment = Tables<"payments">;

const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(n || 0));

const sourceLabels = { app: "Gasbee App", web: "Gasbee Website" };

function PaymentSourceBadge({ row }: { row: Payment }) {
  const source = row.gateway === "chip" ? getGasbeePaymentSource(row.raw_payload, row.order_id) : undefined;
  return <Badge variant="outline" className="whitespace-nowrap">{source ? sourceLabels[source] : "Unknown"}</Badge>;
}

function PaymentDetailsDialog({ row }: { row: Payment }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>View</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Payment details</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-muted-foreground">Gateway</div><div className="font-medium capitalize">{row.gateway}</div></div>
              <div><div className="text-xs text-muted-foreground">Source</div><PaymentSourceBadge row={row} /></div>
              <div><div className="text-xs text-muted-foreground">Status</div><StatusBadge value={row.status} /></div>
              <div><div className="text-xs text-muted-foreground">Amount</div><div className="font-medium">{fmt(row.amount)}</div></div>
              <div><div className="text-xs text-muted-foreground">Reference</div><div className="font-mono text-xs break-all">{row.gateway_ref ?? "—"}</div></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">Order ID</div><div className="font-mono text-xs break-all">{row.order_id}</div></div>
              <div><div className="text-xs text-muted-foreground">Created</div><div>{new Date(row.created_at).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Updated</div><div>{new Date(row.updated_at).toLocaleString()}</div></div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Raw payload</div>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(row.raw_payload ?? {}, null, 2)}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Payments() {
  return (
    <DataListPage<Payment>
      title="Payments" description="All payment transactions."
      table="payments" orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "gateway", label: "Gateway" },
        { key: "source", label: "Source", render: (r) => <PaymentSourceBadge row={r} /> },
        { key: "gateway_ref", label: "Reference", render: (r) => <span className="font-mono text-xs">{r.gateway_ref ?? "—"}</span> },
        { key: "amount", label: "Amount", render: (r) => fmt(r.amount) },
        { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
        { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString() },
      ]}
      rowAction={(r) => <PaymentDetailsDialog row={r} />}
    />
  );
}

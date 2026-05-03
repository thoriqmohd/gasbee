import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
export default function SupportTickets() {
  return (
    <DataListPage
      title="Support Tickets" description="User and merchant support requests." table="support_tickets"
      searchField="subject" orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "subject", label: "Subject" },
        { key: "priority", label: "Priority", render: (r: any) => <StatusBadge value={r.priority} /> },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "created_at", label: "Opened", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

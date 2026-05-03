import { DataListPage } from "@/components/admin/DataListPage";
export default function AuditLogs() {
  return (
    <DataListPage
      title="Audit Logs" description="System actions trail." table="audit_logs"
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "entity_id", label: "Entity ID" },
        { key: "created_at", label: "When", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
    />
  );
}

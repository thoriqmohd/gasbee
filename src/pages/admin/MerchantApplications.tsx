import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MerchantApplications() {
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("merchant_applications").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Application ${status}`); setTimeout(() => location.reload(), 200);
  };
  return (
    <DataListPage
      title="Merchant Applications" description="Review and approve onboarding requests."
      table="merchant_applications" searchField="business_name"
      orderBy={{ column: "created_at", ascending: false }}
      columns={[
        { key: "business_name", label: "Business" },
        { key: "contact_name", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status", render: (r: any) => <StatusBadge value={r.status} /> },
        { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleDateString() },
      ]}
      rowAction={(r: any) => r.status === "pending" ? (
        <div className="flex gap-2 justify-end">
          <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
        </div>
      ) : null}
    />
  );
}

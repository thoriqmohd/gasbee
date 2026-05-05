import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function UserCompanyVerification() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);
  const [form, setForm] = useState({
    company_name: "", ssm_number: "", contact_phone: "", business_address: "",
    ssm_doc_url: "", additional_doc_url: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("company_verifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setExisting(data));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.ssm_doc_url) { toast.error("Please upload SSM document."); return; }
    setBusy(true);
    const payload = {
      user_id: user.id,
      company_name: form.company_name.trim().slice(0, 200),
      ssm_number: form.ssm_number.trim().slice(0, 50),
      contact_phone: form.contact_phone.trim().slice(0, 30),
      business_address: form.business_address.trim().slice(0, 500),
      ssm_doc_url: form.ssm_doc_url,
      additional_doc_url: form.additional_doc_url || null,
    };
    const { error } = await supabase.from("company_verifications").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted. Admin will review shortly.");
    nav("/user/profile");
  };

  if (existing && existing.status !== "rejected") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h1 className="text-lg font-bold">Company Account</h1></div>
        <Card className="space-y-2 p-4 text-sm">
          <div className="flex items-center justify-between"><span className="font-semibold">{existing.company_name}</span><StatusBadge value={existing.status} /></div>
          <div className="text-xs text-muted-foreground">SSM: {existing.ssm_number}</div>
          {existing.status === "pending" && <p className="text-xs">⏳ Application is under review.</p>}
          {existing.status === "approved" && <p className="text-xs text-primary">✓ Approved — you can now order industrial gas.</p>}
          {existing.review_notes && <p className="text-xs text-muted-foreground">Notes: {existing.review_notes}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h1 className="text-lg font-bold">Register Company Account</h1></div>
      <p className="text-sm text-muted-foreground">To purchase industrial gas, please register your company and upload an SSM document for verification.</p>

      {existing?.status === "rejected" && (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm">
          Previous application was rejected. {existing.review_notes && <span>Notes: {existing.review_notes}</span>}
        </Card>
      )}

      <Card className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Company name *</Label><Input required maxLength={200} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>SSM no. *</Label><Input required maxLength={50} value={form.ssm_number} onChange={(e) => setForm({ ...form, ssm_number: e.target.value })} /></div>
            <div><Label>Phone</Label><Input maxLength={30} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </div>
          <div><Label>Business address</Label><Textarea maxLength={500} value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} /></div>
          <div>
            <Label>SSM document *</Label>
            <ImageUpload bucket="company-docs" pathPrefix={`u-${user?.id}`} value={form.ssm_doc_url || null} onChange={(url) => setForm({ ...form, ssm_doc_url: url ?? "" })} label="Upload SSM" />
          </div>
          <div>
            <Label>Additional document (optional)</Label>
            <ImageUpload bucket="company-docs" pathPrefix={`u-${user?.id}`} value={form.additional_doc_url || null} onChange={(url) => setForm({ ...form, additional_doc_url: url ?? "" })} label="Upload doc" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</Button>
        </form>
      </Card>
    </div>
  );
}

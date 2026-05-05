import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function UserApplyMerchant() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<any[]>([]);
  const [form, setForm] = useState({
    business_name: "", contact_name: "", phone: "", email: "",
    address: "", city: "", state: "", postcode: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, email: user.email ?? "" }));
    supabase.from("merchant_applications").select("*").eq("applicant_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setExisting(data ?? []));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("merchant_applications").insert({ ...form, applicant_id: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Permohonan dihantar. Admin akan semak.");
    nav("/user/profile");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><h1 className="text-lg font-bold">Apply to be a Merchant</h1></div>
      <p className="text-sm text-muted-foreground">Isi borang di bawah. Admin akan semak permohonan anda.</p>

      {existing.length > 0 && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold">Permohonan saya</p>
          {existing.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <div className="font-medium">{a.business_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <StatusBadge value={a.status} />
            </div>
          ))}
        </Card>
      )}

      <Card className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Business name *</Label><Input required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Contact name *</Label><Input required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Email *</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Menghantar…" : "Hantar permohonan"}</Button>
        </form>
      </Card>
    </div>
  );
}

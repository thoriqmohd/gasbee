import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function MerchantProfile() {
  const { merchant, refresh } = useMerchantContext();
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (merchant) setForm(merchant); }, [merchant]);

  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const save = async () => {
    const { error } = await supabase.from("merchants").update({
      name: form.name, description: form.description, phone: form.phone, email: form.email,
      address: form.address, city: form.city, state: form.state, postcode: form.postcode, logo_url: form.logo_url,
    }).eq("id", form.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); refresh(); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Merchant profile</h1>
      <Card className="space-y-3 p-6">
        <div><Label>Name</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} /></div>
        <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div><Label>Address</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Postcode</Label><Input value={form.postcode ?? ""} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>State</Label><Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        </div>
        <div><Label>Logo URL</Label><Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
        <Button onClick={save}>Save</Button>
      </Card>
    </div>
  );
}

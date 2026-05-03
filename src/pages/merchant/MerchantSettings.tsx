import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function MerchantSettings() {
  const { user } = useAuth();
  const { merchant } = useMerchantContext();
  const [profile, setProfile] = useState<any>({ full_name: "", phone: "" });
  useEffect(() => { user && supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => data && setProfile(data)); }, [user?.id]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">Account</h2>
        <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div><Label>Full name</Label><Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        <Button onClick={save}>Save account</Button>
      </Card>
      {merchant && (
        <Card className="p-6 text-sm">
          <h2 className="mb-2 font-semibold">Merchant info</h2>
          <p className="text-muted-foreground">Commission rate: {Number(merchant.commission_rate).toFixed(2)}%</p>
          <p className="text-muted-foreground">Status: <span className="capitalize">{merchant.status}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">To change merchant details, go to Profile.</p>
        </Card>
      )}
    </div>
  );
}

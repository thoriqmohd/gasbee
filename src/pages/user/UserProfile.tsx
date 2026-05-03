import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, MapPin, ShoppingBag, LifeBuoy, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function UserProfile() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>({ full_name: "", phone: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data ?? { full_name: "", phone: "" }));
  }, [user]);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Profile</h1>
      <Card className="space-y-3 p-4">
        <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div><Label>Full name</Label><Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        <Button onClick={save} className="w-full">Save</Button>
      </Card>

      <Card className="divide-y">
        {[
          { to: "/user/orders", icon: ShoppingBag, label: "My Orders" },
          { to: "/user/addresses", icon: MapPin, label: "Addresses" },
          { to: "/user/notifications", icon: Bell, label: "Notifications" },
          { to: "/user/support", icon: LifeBuoy, label: "Support" },
        ].map((r) => (
          <Link key={r.to} to={r.to} className="flex items-center gap-3 p-3 text-sm hover:bg-accent">
            <r.icon className="h-4 w-4 text-primary" />{r.label}
          </Link>
        ))}
      </Card>

      <Button variant="outline" className="w-full" onClick={async () => { await signOut(); nav("/user/login"); }}>
        <LogOut className="mr-2 h-4 w-4" />Sign out
      </Button>
    </div>
  );
}

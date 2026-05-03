import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { homeForRoles, AppRole } from "@/hooks/useAuth";

interface Props {
  title: string;
  subtitle: string;
  expectedRoles?: AppRole[];
  showSignup?: boolean;
  signupLink?: string;
}

export const LoginCard = ({ title, subtitle, expectedRoles, showSignup, signupLink }: Props) => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (!data.user) { setBusy(false); return; }
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roles = ((rolesData ?? []) as { role: AppRole }[]).map((r) => r.role);

    if (expectedRoles && !roles.some((r) => expectedRoles.includes(r))) {
      toast.error("This account is not authorised for this app.");
      await supabase.auth.signOut();
      setBusy(false);
      return;
    }
    toast.success("Welcome back");
    nav(homeForRoles(roles), { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/40 p-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)]">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        {showSignup && signupLink && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here? <a href={signupLink} className="font-medium text-primary hover:underline">Create an account</a>
          </p>
        )}
      </Card>
    </div>
  );
};

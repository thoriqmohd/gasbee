import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export default function UserRegister() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/user/home`,
        data: { full_name: fullName, phone },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. You can log in now.");
    nav("/user/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/40 p-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={48} />
          <div><h1 className="text-xl font-bold">Create account</h1><p className="text-xs text-muted-foreground">Join Gasbee</p></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Full name</Label><Input required value={fullName} onChange={(e)=>setFullName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input required value={phone} onChange={(e)=>setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" minLength={6} required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">Already have an account? <a href="/user/login" className="font-medium text-primary hover:underline">Sign in</a></p>
      </Card>
    </div>
  );
}

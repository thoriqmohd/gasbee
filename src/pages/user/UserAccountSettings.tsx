import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User as UserIcon, Trash2, ShieldAlert, Mail, Clock, Database } from "lucide-react";

export default function UserAccountSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({ full_name: "", phone: "", avatar_url: "" });
  const [form, setForm] = useState({ name: "", contact: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data ?? { full_name: "", phone: "", avatar_url: "" };
        setProfile(p);
        setForm((f) => ({
          ...f,
          name: p.full_name ?? "",
          contact: user.email ?? p.phone ?? "",
        }));
      });
  }, [user]);

  const save = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile.full_name, phone: profile.phone })
      .eq("id", user!.id);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const submitDeletion = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.contact.trim()) {
      toast.error("Please fill in your name and registered email/phone");
      return;
    }
    setSubmitting(true);
    const body = [
      "Gasbee Account & Data Deletion Request",
      "",
      `Name: ${form.name}`,
      `Registered email/phone: ${form.contact}`,
      `Account email: ${user.email ?? "-"}`,
      `User ID: ${user.id}`,
      "",
      `Reason: ${form.reason || "(not provided)"}`,
    ].join("\n");
    const { error } = await supabase.from("support_tickets").insert({
      opened_by: user.id,
      subject: "Account Deletion Request",
      body,
      priority: "high" as any,
      context_role: "customer",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your deletion request has been submitted. We will contact you within 3–7 working days.");
    setForm({ ...form, reason: "" });
  };

  return (
    <div className="space-y-5">
      {/* Personal info */}
      <div className="glass-category-card space-y-4 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Personal Info</h2>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={user?.email ?? ""} disabled className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full name</Label>
            <Input
              value={profile.full_name ?? ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="rounded-xl"
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input
              value={profile.phone ?? ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="rounded-xl"
              placeholder="+60..."
            />
          </div>
          <Button onClick={save} className="w-full rounded-xl shadow-md shadow-primary/20">
            Save changes
          </Button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="glass-category-card space-y-4 rounded-2xl border border-destructive/20 p-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Delete Account</h2>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold">Gasbee Account &amp; Data Deletion Request</h3>
          <p className="text-xs text-muted-foreground">
            App: <span className="font-semibold text-foreground">Gasbee</span>
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-xl"
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Registered email / phone</Label>
            <Input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="rounded-xl"
              placeholder="email@example.com or +60..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="min-h-[80px] rounded-xl"
              placeholder="Tell us why you'd like to delete your account"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-muted/40 p-3 text-xs">
          <div className="flex gap-2">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Data that will be deleted</div>
              <p className="text-muted-foreground">
                Profile (name, phone, avatar), saved addresses, cart, notifications, support
                messages, ratings and reviews, and your login credentials.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <div>
              <div className="font-semibold text-foreground">Data that may be retained</div>
              <p className="text-muted-foreground">
                Order records, payment / settlement records, refund history, tax invoices, and
                fraud-prevention logs may be retained as required by law, accounting, payment
                gateway, and anti-fraud regulations.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Processing time</div>
              <p className="text-muted-foreground">
                Requests are processed within <span className="font-semibold">3–7 working days</span>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Contact support</div>
              <a
                href="mailto:support@gasbee.com.my"
                className="text-primary underline-offset-2 hover:underline"
              >
                support@gasbee.com.my
              </a>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={submitting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Request account deletion
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm deletion request</AlertDialogTitle>
              <AlertDialogDescription>
                We will submit your account &amp; data deletion request to Gasbee support. You
                will be contacted within 3–7 working days. Some records may be retained for legal,
                payment, fraud, tax, or order purposes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={submitDeletion} className="bg-destructive hover:bg-destructive/90">
                Submit request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Commissions() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ value: "10", type: "percent", is_default: true });
  const save = async () => {
    const { error } = await supabase.from("commissions").insert({ value: Number(form.value), type: form.type as any, is_default: form.is_default });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false);
    setTimeout(()=>location.reload(),200);
  };
  return (
    <DataListPage
      title="Commissions" description="Platform commission rates." table="commissions"
      orderBy={{ column: "created_at", ascending: false }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Add rate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New commission</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Value (% or RM)</Label><Input type="number" value={form.value} onChange={(e)=>setForm({...form, value: e.target.value})} /></div>
              <Button className="w-full" onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "type", label: "Type" },
        { key: "value", label: "Value" },
        { key: "is_default", label: "Default", render: (r: any) => r.is_default ? "Yes" : "No" },
        { key: "active", label: "Active", render: (r: any) => r.active ? "Yes" : "No" },
      ]}
    />
  );
}

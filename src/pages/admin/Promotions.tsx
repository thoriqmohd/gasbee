import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Promotions() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", value: "10", type: "percent" });
  const save = async () => {
    const { error } = await supabase.from("promotions").insert({ code: form.code.toUpperCase(), description: form.description, value: Number(form.value), type: form.type as any });
    if (error) return toast.error(error.message);
    toast.success("Promo created"); setOpen(false);
    setTimeout(()=>location.reload(),200);
  };
  return (
    <DataListPage
      title="Promotions" description="Discount codes." table="promotions"
      orderBy={{ column: "created_at", ascending: false }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New promo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New promo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Code</Label><Input value={form.code} onChange={(e)=>setForm({...form, code: e.target.value})} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} /></div>
              <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e)=>setForm({...form, value: e.target.value})} /></div>
              <Button onClick={save} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "code", label: "Code" },
        { key: "type", label: "Type" },
        { key: "value", label: "Value" },
        { key: "used_count", label: "Used" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "Yes" : "No" },
      ]}
    />
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Banners() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", image_url: "", link_url: "" });
  const save = async () => {
    const { error } = await supabase.from("banners").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Banner created"); setOpen(false);
    setTimeout(()=>location.reload(),200);
  };
  return (
    <DataListPage
      title="Banners" description="Promotional banners shown in the user app." table="banners"
      orderBy={{ column: "sort_order", ascending: true }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New banner</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New banner</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} /></div>
              <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e)=>setForm({...form, image_url: e.target.value})} /></div>
              <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e)=>setForm({...form, link_url: e.target.value})} /></div>
              <Button onClick={save} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "title", label: "Title" },
        { key: "image_url", label: "Image", render: (r: any) => <img src={r.image_url} alt="" className="h-10 w-20 rounded object-cover" /> },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "Yes" : "No" },
      ]}
    />
  );
}

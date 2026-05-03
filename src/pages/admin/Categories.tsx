import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataListPage } from "@/components/admin/DataListPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Categories() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = async () => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await supabase.from("categories").insert({ name, slug });
    if (error) return toast.error(error.message);
    toast.success("Category created"); setOpen(false); setName("");
    setTimeout(()=>location.reload(),200);
  };
  return (
    <DataListPage
      title="Categories" description="Product categories." table="categories" searchField="name"
      orderBy={{ column: "sort_order", ascending: true }}
      topAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "sort_order", label: "Order" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "Yes" : "No" },
      ]}
    />
  );
}

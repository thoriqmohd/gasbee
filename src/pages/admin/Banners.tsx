import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ImageUpload";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type Banner = {
  id: string; title: string | null; image_url: string; link_url: string | null;
  is_active: boolean; sort_order: number;
};

export default function Banners() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [open, setOpen] = useState(false);
  const empty = { id: "", title: "", image_url: "", link_url: "", is_active: true, sort_order: 0 };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setRows((data ?? []) as Banner[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.image_url) { toast.error("Upload an image"); return; }
    const payload = { title: form.title || null, image_url: form.image_url, link_url: form.link_url || null, is_active: form.is_active, sort_order: Number(form.sort_order) || 0 };
    const { error } = form.id
      ? await supabase.from("banners").update(payload).eq("id", form.id)
      : await supabase.from("banners").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setForm(empty); load();
  };

  const edit = (b: Banner) => { setForm({ ...b, title: b.title ?? "", link_url: b.link_url ?? "" }); setOpen(true); };
  const del = async (id: string) => { if (!confirm("Delete banner?")) return; const { error } = await supabase.from("banners").delete().eq("id", id); if (error) return toast.error(error.message); load(); };
  const toggle = async (b: Banner) => { await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banners</h1>
          <p className="text-sm text-muted-foreground">Promotional banners shown on the user home (rotating carousel).</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
          <DialogTrigger asChild><Button onClick={() => setForm(empty)}>+ New banner</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} banner</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} /></div>
              <div><Label>Image</Label><ImageUpload bucket="banners" value={form.image_url} onChange={(u)=>setForm({...form, image_url: u})} aspect="wide" label="Upload banner" /></div>
              <div><Label>Link URL (optional)</Label><Input value={form.link_url} onChange={(e)=>setForm({...form, link_url: e.target.value})} placeholder="/user/merchants" /></div>
              <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e)=>setForm({...form, sort_order: e.target.value})} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v)=>setForm({...form, is_active: v})} /><Label>Active</Label></div>
              <Button onClick={save} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((b) => (
          <Card key={b.id} className="overflow-hidden">
            <img src={b.image_url} alt={b.title ?? ""} className="h-32 w-full object-cover" />
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{b.title ?? "Untitled"}</div>
                <Switch checked={b.is_active} onCheckedChange={() => toggle(b)} />
              </div>
              {b.link_url && <div className="truncate text-xs text-muted-foreground">{b.link_url}</div>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(b)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No banners yet.</Card>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, Info } from "lucide-react";

const fmt = (r: any) => r.type === "percent" ? `${r.value}%` : `RM ${Number(r.value).toFixed(2)}`;

function CommissionForm({ row, onDone }: { row?: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [form, setForm] = useState({
    value: row?.value ?? 10,
    type: row?.type ?? "percent",
    is_default: row?.is_default ?? false,
    active: row?.active ?? true,
    merchant_id: row?.merchant_id ?? "default",
  });
  useEffect(() => { if (open) supabase.from("merchants").select("id,name").order("name").then(({ data }) => setMerchants(data ?? [])); }, [open]);

  const save = async () => {
    const payload: any = {
      value: Number(form.value), type: form.type as any,
      is_default: form.is_default, active: form.active,
      merchant_id: form.merchant_id === "default" ? null : form.merchant_id,
    };
    const { error } = row
      ? await supabase.from("commissions").update(payload).eq("id", row.id)
      : await supabase.from("commissions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? <Button size="sm" variant="outline"><Pencil className="mr-1 h-3 w-3" />Edit</Button> : <Button>+ Add rate</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{row ? "Edit" : "New"} commission</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded bg-muted p-3 text-xs">
            <strong>Apa itu commission?</strong> Kadar ini ditolak dari setiap order paid sebagai pendapatan platform Gasbee. Default rate dipakai untuk semua merchant kecuali ada rate khusus untuk merchant tertentu.
          </div>
          <div><Label>Apply to</Label>
            <Select value={form.merchant_id} onValueChange={(v) => setForm({ ...form, merchant_id: v, is_default: v === "default" ? form.is_default : false })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (all merchants)</SelectItem>
                {merchants.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="flat">Flat (RM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Value</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value as any })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} disabled={form.merchant_id !== "default"} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Mark as default rate
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          </label>
          <Button className="w-full" onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Commissions() {
  const [rows, setRows] = useState<any[]>([]);
  const [merchantMap, setMerchantMap] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("commissions").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.merchant_id).filter(Boolean)));
    if (ids.length) {
      const { data: ms } = await supabase.from("merchants").select("id,name").in("id", ids);
      const m: Record<string, string> = {}; (ms ?? []).forEach((x: any) => { m[x.id] = x.name; });
      setMerchantMap(m);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this commission rate?")) return;
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-sm text-muted-foreground">Platform commission rates per merchant or default.</p>
        </div>
        <CommissionForm onDone={load} />
      </div>
      <Card className="flex items-start gap-2 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <strong>Cara berfungsi:</strong> Bila admin generate settlement, sistem ambil rate khusus untuk merchant tu dahulu. Kalau tiada, gunakan default rate. Kadar tu didarab dengan gross sales merchant untuk dapatkan komisen.
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Apply to</th><th className="p-3">Type</th><th className="p-3">Rate</th>
            <th className="p-3">Default</th><th className="p-3">Active</th><th className="p-3">Created</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{r.merchant_id ? (merchantMap[r.merchant_id] ?? "—") : <span className="font-semibold">Default</span>}</td>
                <td className="p-3 capitalize">{r.type}</td>
                <td className="p-3 font-semibold">{fmt(r)}</td>
                <td className="p-3">{r.is_default ? "Yes" : "—"}</td>
                <td className="p-3">{r.active ? "Yes" : "No"}</td>
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <CommissionForm row={r} onDone={load} />
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No commission rates set.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

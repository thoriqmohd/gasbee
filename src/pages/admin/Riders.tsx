import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export default function Riders() {
  const [rows, setRows] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("riders").select("*").order("created_at", { ascending: false }).limit(200);
    if (q) query = query.ilike("full_name", `%${q}%`);
    const { data } = await query;
    setRows(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.merchant_id).filter(Boolean)));
    if (ids.length) {
      const { data: ms } = await supabase.from("merchants").select("id,name").in("id", ids);
      const map: Record<string, string> = {};
      (ms ?? []).forEach((m: any) => { map[m.id] = m.name; });
      setMerchants(map);
    } else setMerchants({});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const toggleActive = async (r: any) => {
    const { error } = await supabase.from("riders").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.is_active ? "Suspended" : "Activated"); load();
  };

  const remove = async (r: any) => {
    if (!confirm(`Delete rider "${r.full_name}"?`)) return;
    const { error } = await supabase.from("riders").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Riders</h1><p className="text-sm text-muted-foreground">All delivery riders.</p></div>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Name</th><th className="p-3">Merchant</th><th className="p-3">Phone</th><th className="p-3">Vehicle</th>
            <th className="p-3">Status</th><th className="p-3">Active</th><th className="p-3">Rating</th><th className="p-3">Deliveries</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{r.full_name}</td>
                <td className="p-3">{r.merchant_id ? (merchants[r.merchant_id] ?? <span className="text-muted-foreground">—</span>) : <span className="text-muted-foreground">Unassigned</span>}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3 capitalize">{r.vehicle_type ?? "—"} {r.vehicle_plate ?? ""}</td>
                <td className="p-3"><StatusBadge value={r.status} /></td>
                <td className="p-3">{r.is_active ? "Yes" : <span className="text-destructive">Suspended</span>}</td>
                <td className="p-3">★ {Number(r.rating ?? 0).toFixed(1)}</td>
                <td className="p-3">{r.total_deliveries}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline"><Link to={`/riders/${r.id}`}>View</Link></Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>{r.is_active ? "Suspend" : "Activate"}</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No riders.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

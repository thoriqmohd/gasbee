import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function Customers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (q) query = query.ilike("full_name", `%${q}%`);
    const { data } = await query;
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-sm text-muted-foreground">All registered buyers.</p></div>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground"><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Active</th><th className="p-3">Joined</th><th className="p-3"></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{r.full_name ?? "—"}</td>
                <td className="p-3">{r.phone ?? "—"}</td>
                <td className="p-3">{r.is_active ? <StatusBadge value="active" /> : <StatusBadge value="inactive" />}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link to={`/customers/${r.id}`}>View</Link></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No customers.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

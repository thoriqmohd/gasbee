import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (entity !== "all") q = q.eq("entity", entity);
    if (search) q = q.ilike("action", `%${search}%`);
    if (from) q = q.gte("created_at", from + "T00:00:00");
    if (to) q = q.lte("created_at", to + "T23:59:59");
    const { data } = await q;
    setRows(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { m[p.id] = p.full_name ?? p.id.slice(0, 8); });
      setActorMap(m);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity, search, from, to]);

  const entities = Array.from(new Set(rows.map((r) => r.entity)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Audit Logs</h1><p className="text-sm text-muted-foreground">System actions trail.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search action…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th>
            <th className="p-3">Entity</th><th className="p-3">Entity ID</th><th className="p-3">IP</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t"><td colSpan={7} className="p-3"><Skeleton className="h-5 w-full" /></td></tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No audit logs.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{r.actor_id ? (actorMap[r.actor_id] ?? r.actor_id.slice(0, 8)) : "system"}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3">{r.entity}</td>
                <td className="p-3 font-mono text-xs">{r.entity_id?.slice(0, 8) ?? "—"}</td>
                <td className="p-3 text-xs">{r.ip ?? "—"}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setOpen(r)}>Payload</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{open?.action} • {open?.entity}</DialogTitle></DialogHeader>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(open?.payload ?? {}, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

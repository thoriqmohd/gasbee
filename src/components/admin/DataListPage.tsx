import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Tables = keyof Database["public"]["Tables"];

interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T = any> {
  title: string;
  description?: string;
  table: Tables;
  columns: Column<T>[];
  searchField?: string;
  orderBy?: { column: string; ascending?: boolean };
  rowAction?: (row: T) => React.ReactNode;
  topAction?: React.ReactNode;
  selectQuery?: string;
}

export function DataListPage<T = any>({
  title, description, table, columns, searchField, orderBy, rowAction, topAction, selectQuery = "*",
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    let q: any = supabase.from(table as any).select(selectQuery).limit(200);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    if (search && searchField) q = q.ilike(searchField, `%${search}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as T[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {searchField && (
            <Input placeholder="Search…" value={search} onChange={(e)=>setSearch(e.target.value)} className="w-64" />
          )}
          <Button variant="outline" onClick={load}>Refresh</Button>
          {topAction}
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((c) => (<th key={c.key} className="px-4 py-3 text-left font-medium">{c.label}</th>))}
                {rowAction && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t"><td colSpan={columns.length + (rowAction ? 1 : 0)} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + (rowAction ? 1 : 0)} className="p-8 text-center text-muted-foreground">No records yet.</td></tr>
              ) : rows.map((r: any, i) => (
                <tr key={r.id ?? i} className="border-t hover:bg-muted/30">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 align-middle">
                      {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                    </td>
                  ))}
                  {rowAction && <td className="px-4 py-3 text-right">{rowAction(r)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

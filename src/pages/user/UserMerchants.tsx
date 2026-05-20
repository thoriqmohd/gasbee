import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { haversineKm } from "@/lib/delivery";

export default function UserMerchants() {
  const [items, setItems] = useState<any[]>([]);
  const [addr, setAddr] = useState<any>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("merchants").select("*").eq("status", "active").then(({ data }) => setItems(data ?? []));
    supabase.from("addresses").select("*").eq("is_default", true).maybeSingle().then(({ data }) => setAddr(data));
  }, []);

  const withDistance = items.map((m) => {
    const d = addr?.latitude && addr?.longitude && m.latitude != null && m.longitude != null
      ? haversineKm(addr.latitude, addr.longitude, m.latitude, m.longitude) : null;
    const inRange = d == null ? true : d <= Number(m.delivery_radius_km ?? 10);
    return { ...m, _distance: d, _inRange: inRange };
  });
  const filtered = withDistance
    .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => m._inRange);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Merchants</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchants" className="pl-9" />
      </div>
      <div className="space-y-2">
        {filtered.map((m) => (
          <Link key={m.id} to={`/user/merchant/${m.id}`}>
            <Card className="flex items-center gap-3 p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                {m.logo_url ? <img src={m.logo_url} alt={m.name} className="h-full w-full rounded-lg object-cover" /> : <Store className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.city ?? "—"} · ★ {Number(m.rating ?? 0).toFixed(1)}
                  {m._distance != null && <> · {m._distance.toFixed(1)} km</>}
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No merchants deliver to your area.</p>}
      </div>
    </div>
  );
}

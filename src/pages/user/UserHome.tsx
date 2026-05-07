import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Search, RefreshCw, Flame, CookingPot, Factory, Package, Store, Star, ChevronRight } from "lucide-react";

const categoryIcon = (c: any) => {
  const key = `${c.slug ?? ""} ${c.name ?? ""}`.toLowerCase();
  if (key.includes("refill")) return RefreshCw;
  if (key.includes("new") || key.includes("cylinder")) return Flame;
  if (key.includes("accessor")) return CookingPot;
  if (key.includes("industrial")) return Factory;
  return Package;
};
import { Link } from "react-router-dom";
import { BannerCarousel } from "@/components/user/BannerCarousel";

export default function UserHome() {
  const [banners, setBanners] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [addr, setAddr] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [b, c, m, a] = await Promise.all([
        supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("merchants").select("*").eq("status","active").limit(10),
        supabase.from("addresses").select("*").eq("is_default", true).maybeSingle(),
      ]);
      setBanners(b.data ?? []); setCats(c.data ?? []); setMerchants(m.data ?? []); setAddr(a.data);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <Card className="flex items-center gap-2 p-3">
        <MapPin className="h-4 w-4 text-primary" />
        <div className="flex-1 truncate text-sm">
          <div className="text-xs text-muted-foreground">Deliver to</div>
          <Link to="/user/addresses" className="font-medium">{addr?.address_line1 ?? "Select an address"}</Link>
        </div>
      </Card>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search gas, dealers…" className="pl-9" />
      </div>
      <BannerCarousel banners={banners} />
      <div>
        <h2 className="mb-3 text-sm font-semibold">Categories</h2>
        <div className="grid grid-cols-4 gap-3">
          {cats.map((c) => {
            const Icon = categoryIcon(c);
            return (
              <Link key={c.id} to={`/user/products?category=${c.id}`}>
                <div className="glass-category-card flex flex-col items-center gap-2 rounded-2xl p-3 text-center">
                  <div className="glass-category-icon flex h-10 w-10 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="text-[11px] font-medium leading-tight">{c.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">Nearby merchants</h2>
        <div className="space-y-2">
          {merchants.map((m) => (
            <Link key={m.id} to={`/user/merchant/${m.id}`}>
              <Card className="flex items-center gap-3 p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {m.logo_url ? <img src={m.logo_url} alt={m.name} className="h-full w-full rounded-lg object-cover" /> : <Store className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.city ?? "—"} · ★ {Number(m.rating ?? 0).toFixed(1)}</div>
                </div>
              </Card>
            </Link>
          ))}
          {merchants.length === 0 && <p className="text-sm text-muted-foreground">No merchants nearby yet.</p>}
        </div>
      </div>
    </div>
  );
}

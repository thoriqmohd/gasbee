import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Package, Store, Star, ChevronRight, Flame, X } from "lucide-react";
import categoryRefill from "@/assets/category-refill.png";
import categoryNew from "@/assets/category-new.png";
import categoryAccessories from "@/assets/category-accessories.png";
import categoryIndustrial from "@/assets/category-industrial.png";

const categoryImage = (c: any): string | null => {
  const key = `${c.slug ?? ""} ${c.name ?? ""}`.toLowerCase();
  if (key.includes("refill")) return categoryRefill;
  if (key.includes("new") || key.includes("cylinder")) return categoryNew;
  if (key.includes("accessor")) return categoryAccessories;
  if (key.includes("industrial")) return categoryIndustrial;
  return null;
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
            const img = categoryImage(c);
            return (
              <Link key={c.id} to={`/user/products?category=${c.id}`} className="group">
                <div className="glass-category-card flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-primary/20 group-active:scale-95">
                  <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    {img ? (
                      <img src={img} alt={c.name} className="h-full w-full object-contain drop-shadow-md transition-all duration-300 group-hover:drop-shadow-[0_8px_16px_hsl(var(--primary)/0.4)]" />
                    ) : (
                      <Package className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="text-xs font-medium leading-tight transition-colors group-hover:text-primary">{c.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nearby merchants</h2>
          <span className="text-[11px] text-muted-foreground">{merchants.length} nearby</span>
        </div>
        <div className="space-y-2.5">
          {merchants.map((m) => (
            <Link key={m.id} to={`/user/merchant/${m.id}`} className="block">
              <div className="glass-category-card group flex items-center gap-3 rounded-2xl p-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15">
                  {m.logo_url ? (
                    <img src={m.logo_url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-primary" />
                  )}
                  <span className="absolute -right-0 -top-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" aria-label="Open" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold leading-tight">{m.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{m.city ?? "—"}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span className="font-medium text-foreground">{Number(m.rating ?? 0).toFixed(1)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-active:translate-x-0.5" />
              </div>
            </Link>
          ))}
          {merchants.length === 0 && (
            <div className="glass-category-card rounded-2xl p-6 text-center">
              <Store className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No merchants nearby yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

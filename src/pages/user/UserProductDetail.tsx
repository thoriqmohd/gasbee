import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Minus, Plus } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

export default function UserProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [p, setP] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [type, setType] = useState<"refill" | "new" | "deposit">("refill");

  useEffect(() => {
    if (!id) return;
    supabase.from("products").select("*, merchants(name)").eq("id", id).maybeSingle().then(({ data }) => {
      setP(data);
      if (data && Number(data.refill_price) === 0 && Number(data.selling_price) > 0) setType("new");
    });
  }, [id]);

  if (!p) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const price = type === "refill" ? Number(p.refill_price) : type === "new" ? Number(p.selling_price) : Number(p.deposit_amount);

  const addToCart = () => {
    add({
      product_id: p.id,
      merchant_id: p.merchant_id,
      name: p.name,
      image_url: p.image_url,
      type, cylinder_size_kg: p.cylinder_size_kg,
      unit_price: price, quantity: qty,
    });
    toast.success("Added to cart");
    nav("/user/cart");
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex h-48 items-center justify-center bg-muted">
          {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Flame className="h-16 w-16 text-primary" />}
        </div>
      </Card>
      <div>
        <div className="text-xs text-muted-foreground">{p.merchants?.name}</div>
        <h1 className="text-xl font-bold">{p.name}</h1>
        {p.cylinder_size_kg && <div className="text-sm text-muted-foreground">{p.cylinder_size_kg} kg cylinder</div>}
        {p.description && <p className="mt-2 text-sm">{p.description}</p>}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Order type</div>
        <div className="grid grid-cols-3 gap-2">
          {Number(p.refill_price) > 0 && <Button variant={type === "refill" ? "default" : "outline"} size="sm" onClick={() => setType("refill")}>Refill RM{Number(p.refill_price).toFixed(2)}</Button>}
          {Number(p.selling_price) > 0 && <Button variant={type === "new" ? "default" : "outline"} size="sm" onClick={() => setType("new")}>New RM{Number(p.selling_price).toFixed(2)}</Button>}
          {Number(p.deposit_amount) > 0 && <Button variant={type === "deposit" ? "default" : "outline"} size="sm" onClick={() => setType("deposit")}>Deposit RM{Number(p.deposit_amount).toFixed(2)}</Button>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">Quantity</div>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></Button>
          <span className="w-6 text-center font-semibold">{qty}</span>
          <Button size="icon" variant="outline" onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="sticky bottom-20 flex items-center justify-between rounded-lg border bg-card p-3">
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold text-primary">RM {(price * qty).toFixed(2)}</div>
        </div>
        <Button onClick={addToCart} disabled={price <= 0}>Add to cart</Button>
      </div>
    </div>
  );
}

import { useCart } from "@/hooks/useCart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, Flame } from "lucide-react";
import { Link } from "react-router-dom";

export default function UserCart() {
  const { items, setQty, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Flame className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild><Link to="/user/products">Browse products</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Cart</h1>
      {items.map((it) => (
        <Card key={`${it.product_id}-${it.type}`} className="flex items-center gap-3 p-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
            {it.image_url ? <img src={it.image_url} alt={it.name} className="h-full w-full rounded-lg object-cover" /> : <Flame className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{it.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{it.type}</div>
            <div className="text-sm font-semibold text-primary">RM {it.unit_price.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(it.product_id, it.type, it.quantity - 1)}><Minus className="h-3 w-3" /></Button>
            <span className="w-5 text-center text-sm">{it.quantity}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(it.product_id, it.type, it.quantity + 1)}><Plus className="h-3 w-3" /></Button>
          </div>
          <Button size="icon" variant="ghost" onClick={() => remove(it.product_id, it.type)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </Card>
      ))}
      <div className="sticky bottom-20 rounded-lg border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm">Subtotal</span>
          <span className="text-lg font-bold text-primary">RM {subtotal.toFixed(2)}</span>
        </div>
        <Button asChild className="w-full"><Link to="/user/checkout">Checkout</Link></Button>
      </div>
    </div>
  );
}

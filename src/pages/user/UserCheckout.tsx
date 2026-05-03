import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { calcDeliveryFee, haversineKm, DELIVERY_RATE } from "@/lib/delivery";

export default function UserCheckout() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addrId, setAddrId] = useState<string>("");
  const [merchant, setMerchant] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "fpx" | "card" | "ewallet">("cod");
  const [deliveryType, setDeliveryType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const totalKg = items.reduce((a, it: any) => a + Number(it.cylinder_size_kg ?? 0) * it.quantity, 0);
  const addr = addresses.find((a) => a.id === addrId);
  const distanceKm = haversineKm(addr?.latitude, addr?.longitude, merchant?.latitude, merchant?.longitude);
  const feeCalc = calcDeliveryFee({ distanceKm, totalKg });
  const deliveryFee = subtotal > 0 ? feeCalc.fee : 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  useEffect(() => {
    if (!user) return;
    supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).then(({ data }) => {
      setAddresses(data ?? []);
      const def = data?.find((a) => a.is_default) ?? data?.[0];
      if (def) setAddrId(def.id);
    });
  }, [user]);

  useEffect(() => {
    const mid = items[0]?.merchant_id;
    if (!mid) { setMerchant(null); return; }
    supabase.from("merchants").select("id,latitude,longitude,name").eq("id", mid).maybeSingle().then(({ data }) => setMerchant(data));
  }, [items[0]?.merchant_id]);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    const { data } = await supabase.from("promotions").select("*").eq("code", promoCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Invalid promo code"); setDiscount(0); return; }
    if (data.min_order_amount && subtotal < Number(data.min_order_amount)) { toast.error(`Min order RM${data.min_order_amount}`); return; }
    const d = data.type === "percent" ? subtotal * (Number(data.value) / 100) : Number(data.value);
    setDiscount(d);
    toast.success(`Promo applied: -RM${d.toFixed(2)}`);
  };

  const placeOrder = async () => {
    if (!user || !addrId || items.length === 0) { toast.error("Select address and add items"); return; }
    if (deliveryType === "scheduled" && (!scheduledAt || new Date(scheduledAt) <= new Date())) { toast.error("Pick a future date/time for scheduled delivery"); return; }
    setBusy(true);
    const addr2 = addresses.find((a) => a.id === addrId);
    const merchant_id = items[0].merchant_id;

    const { data: order, error } = await supabase.from("orders").insert({
      customer_id: user.id,
      merchant_id,
      address_snapshot: addr2 as any,
      items_subtotal: subtotal,
      delivery_fee: deliveryFee,
      discount,
      total_amount: total,
      payment_method: paymentMethod,
      payment_status: "pending",
      status: "pending",
      delivery_type: deliveryType,
      scheduled_at: deliveryType === "scheduled" ? scheduledAt : null,
      notes,
      promotion_code: promoCode || null,
    }).select().single();

    if (error || !order) { toast.error(error?.message ?? "Order failed"); setBusy(false); return; }

    const orderItems = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      product_name: it.name,
      product_image_url: it.image_url,
      type: (it.type === "new" ? "new_cylinder" : it.type) as "refill" | "new_cylinder" | "deposit",
      cylinder_size_kg: it.cylinder_size_kg,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.unit_price * it.quantity,
    }));
    await supabase.from("order_items").insert(orderItems);

    clear();
    toast.success("Order placed!");
    nav(`/user/orders/${order.id}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Checkout</h1>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Delivery address</span>
          <Button variant="link" size="sm" onClick={() => nav("/user/addresses")}>Manage</Button>
        </div>
        {addresses.length === 0 && <Card className="p-3 text-sm text-muted-foreground">Add an address first.</Card>}
        <RadioGroup value={addrId} onValueChange={setAddrId} className="space-y-2">
          {addresses.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-3">
              <RadioGroupItem value={a.id} id={a.id} className="mt-1" />
              <Label htmlFor={a.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1 text-sm font-medium"><MapPin className="h-3 w-3" />{a.label ?? "Address"}</div>
                <div className="text-xs text-muted-foreground">{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ""}, {a.postcode} {a.city}</div>
              </Label>
            </Card>
          ))}
        </RadioGroup>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Items</div>
        <Card className="divide-y">
          {items.map((it) => (
            <div key={`${it.product_id}-${it.type}`} className="flex justify-between p-3 text-sm">
              <span>{it.name} × {it.quantity}</span>
              <span>RM {(it.unit_price * it.quantity).toFixed(2)}</span>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Promo code</div>
        <div className="flex gap-2">
          <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter code" />
          <Button variant="outline" onClick={applyPromo}>Apply</Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Payment method</div>
        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="grid grid-cols-2 gap-2">
          {["cod","fpx","card","ewallet"].map((m) => (
            <Card key={m} className="flex items-center gap-2 p-3">
              <RadioGroupItem value={m} id={m} />
              <Label htmlFor={m} className="cursor-pointer text-sm capitalize">{m}</Label>
            </Card>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label className="text-sm font-semibold">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions" maxLength={500} />
      </div>

      <Card className="space-y-1 p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>RM {subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between">
          <span>Delivery {distanceKm != null && <span className="text-xs text-muted-foreground">({distanceKm.toFixed(1)} km · {totalKg} kg)</span>}</span>
          <span>RM {deliveryFee.toFixed(2)}</span>
        </div>
        {subtotal > 0 && (
          <div className="text-[10px] text-muted-foreground">Base RM{DELIVERY_RATE.BASE} + RM{DELIVERY_RATE.PER_KM}/km + RM{DELIVERY_RATE.PER_KG}/kg{distanceKm == null && " · estimated, set address coordinates for accurate fee"}</div>
        )}
        {discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>- RM {discount.toFixed(2)}</span></div>}
        <div className="mt-1 flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="text-primary">RM {total.toFixed(2)}</span></div>
      </Card>

      <Button className="w-full" onClick={placeOrder} disabled={busy || items.length === 0 || !addrId}>
        {busy ? "Placing…" : `Place order · RM ${total.toFixed(2)}`}
      </Button>
    </div>
  );
}

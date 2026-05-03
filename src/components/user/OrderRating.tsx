import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface Props { orderId: string; hasRider: boolean; }

export function OrderRating({ orderId, hasRider }: Props) {
  const { user } = useAuth();
  const [existing, setExisting] = useState<any>(null);
  const [merchantRating, setMerchantRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("ratings").select("*").eq("order_id", orderId).maybeSingle().then(({ data }) => setExisting(data));
  }, [orderId]);

  if (existing) {
    return (
      <Card className="p-3 text-sm">
        <div className="mb-1 font-semibold">Your rating</div>
        <div>Merchant: {"★".repeat(existing.merchant_rating ?? 0)}{"☆".repeat(5 - (existing.merchant_rating ?? 0))}</div>
        {hasRider && <div>Rider: {"★".repeat(existing.rider_rating ?? 0)}{"☆".repeat(5 - (existing.rider_rating ?? 0))}</div>}
        {existing.comment && <div className="mt-1 text-xs text-muted-foreground">"{existing.comment}"</div>}
      </Card>
    );
  }

  const submit = async () => {
    if (!user) return;
    if (!merchantRating) { toast.error("Please rate the merchant"); return; }
    setBusy(true);
    const { error } = await supabase.from("ratings").insert({
      order_id: orderId, customer_id: user.id, merchant_rating: merchantRating,
      rider_rating: hasRider ? riderRating || null : null, comment: comment || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your feedback!");
    setExisting({ merchant_rating: merchantRating, rider_rating: riderRating, comment });
  };

  const Stars = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <Card className="space-y-3 p-3">
      <div className="text-sm font-semibold">Rate this order</div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Merchant</div>
        <Stars value={merchantRating} onChange={setMerchantRating} />
      </div>
      {hasRider && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Rider</div>
          <Stars value={riderRating} onChange={setRiderRating} />
        </div>
      )}
      <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <Button className="w-full" onClick={submit} disabled={busy}>Submit rating</Button>
    </Card>
  );
}

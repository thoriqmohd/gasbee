import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Store, Bike, Sparkles, Quote } from "lucide-react";
import { toast } from "sonner";

interface Props { orderId: string; hasRider: boolean; }

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function OrderRating({ orderId, hasRider }: Props) {
  const { user } = useAuth();
  const [existing, setExisting] = useState<any>(null);
  const [merchantRating, setMerchantRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [hoverM, setHoverM] = useState(0);
  const [hoverR, setHoverR] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("ratings").select("*").eq("order_id", orderId).maybeSingle().then(({ data }) => setExisting(data));
  }, [orderId]);

  const StarRow = ({ value }: { value: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? "fill-primary text-primary" : "fill-muted text-muted"}`}
        />
      ))}
    </div>
  );

  if (existing) {
    return (
      <div className="glass-category-card animate-fade-in relative overflow-hidden rounded-2xl p-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/0 blur-2xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/30">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="text-sm font-semibold">Your Rating</div>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Merchant</span>
              </div>
              <StarRow value={existing.merchant_rating ?? 0} />
            </div>
            {hasRider && existing.rider_rating != null && (
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5">
                <div className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Rider</span>
                </div>
                <StarRow value={existing.rider_rating ?? 0} />
              </div>
            )}
            {existing.comment && (
              <div className="relative rounded-xl border border-border/50 bg-background/50 p-3 pl-8">
                <Quote className="absolute left-2 top-2 h-4 w-4 text-primary/40" />
                <p className="text-xs italic text-muted-foreground">{existing.comment}</p>
              </div>
            )}
          </div>
        </div>
      </div>
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

  const StarPicker = ({
    value, onChange, hover, setHover,
  }: { value: number; onChange: (n: number) => void; hover: number; setHover: (n: number) => void }) => {
    const display = hover || value;
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              className="transition-transform duration-150 hover:scale-125 active:scale-110"
            >
              <Star
                className={`h-8 w-8 transition-all duration-200 ${
                  n <= display
                    ? "fill-primary text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
        <div className={`text-[11px] font-medium transition-colors ${display ? "text-primary" : "text-muted-foreground"}`}>
          {LABELS[display] || "Tap to rate"}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-category-card animate-fade-in relative overflow-hidden rounded-2xl p-4">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-primary/20 to-primary/0 blur-2xl" />
      <div className="relative space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-sm font-semibold">How was your experience?</div>
          <p className="text-[11px] text-muted-foreground">Your feedback helps everyone</p>
        </div>

        <div className="rounded-2xl bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium">
            <Store className="h-3.5 w-3.5 text-primary" /> Merchant
          </div>
          <StarPicker value={merchantRating} onChange={setMerchantRating} hover={hoverM} setHover={setHoverM} />
        </div>

        {hasRider && (
          <div className="rounded-2xl bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium">
              <Bike className="h-3.5 w-3.5 text-primary" /> Rider
            </div>
            <StarPicker value={riderRating} onChange={setRiderRating} hover={hoverR} setHover={setHoverR} />
          </div>
        )}

        <Textarea
          placeholder="Tell us more (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          className="rounded-xl resize-none"
          rows={3}
        />
        <Button
          className="w-full rounded-xl shadow-md shadow-primary/20"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Submitting..." : "Submit Rating"}
        </Button>
      </div>
    </div>
  );
}

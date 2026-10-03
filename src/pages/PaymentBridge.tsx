import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// CHIP can only redirect to https URLs (it rejects the gasbee:// scheme), so
// the gateway lands on this public page which bounces straight into the
// native app via the deep link. Plain web users get the fallback UI below.
export default function PaymentBridge() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") === "failed" ? "failed" : "success";
  const orderId = searchParams.get("order_id");
  const [appMissed, setAppMissed] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    window.location.href = `gasbee:///user/orders/${orderId}?payment=${status}`;
    const t = setTimeout(() => setAppMissed(true), 2000);
    return () => clearTimeout(t);
  }, [orderId, status]);

  const ok = status === "success";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-background p-4 text-center">
      {ok ? (
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
      ) : (
        <XCircle className="h-14 w-14 text-destructive" />
      )}
      <h1 className="text-xl font-bold">{ok ? "Pembayaran berjaya!" : "Pembayaran tidak selesai"}</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {ok
          ? "Terima kasih. Sedang membawa anda kembali ke app Gasbee…"
          : "Sila cuba semak pesanan anda dan bayar semula di app Gasbee."}
      </p>
      {!appMissed && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {appMissed && orderId && (
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <a
            href={`gasbee:///user/orders/${orderId}?payment=${status}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Buka App Gasbee
          </a>
          <Link to={`/user/orders/${orderId}`} className="text-sm text-muted-foreground underline">
            Atau lihat pesanan di sini
          </Link>
        </div>
      )}
    </div>
  );
}

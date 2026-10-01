import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const KEYS = [
  { key: "platform_name", label: "Platform name", default: "Gasbee" },
  { key: "support_email", label: "Support email", default: "support@gasbee.com.my" },
  { key: "default_commission_pct", label: "Default commission (%)", default: "10" },
  { key: "delivery_base_fee", label: "Delivery base fee (MYR)", default: "5" },
  { key: "delivery_base_km", label: "Delivery base distance (km)", default: "5" },
  { key: "delivery_per_km", label: "Delivery per additional km (MYR)", default: "1" },
  { key: "processing_fee", label: "Processing fee (MYR)", default: "1.50" },
  { key: "gas_exchange_fee", label: "Non-Petronas gas exchange charge per refill cylinder (MYR)", default: "3" },
];

const SERVICE_FEE_KEYS = [
  { key: "service_fee", label: "Landed", default: "5" },
  { key: "service_fee_highrise", label: "High-Rise", default: "8" },
];

const DEV_KEYS = [
  { key: "dev_mode_enabled", default: "false" },
  { key: "dev_mode_title", default: "Mobile App is in trial period" },
  { key: "dev_mode_message", default: "The app is currently under redevelopment. No deliveries will be made during this period." },
  { key: "dev_mode_button", default: "Got it" },
];

const unwrapNum = (v: unknown): string => {
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).value);
  return typeof v === "string" ? v : JSON.stringify(v);
};

export default function Settings() {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        m[r.key] = SERVICE_FEE_KEYS.some((k) => k.key === r.key) ? unwrapNum(r.value) : (typeof r.value === "string" ? r.value : JSON.stringify(r.value));
      });
      [...KEYS, ...SERVICE_FEE_KEYS, ...DEV_KEYS].forEach((k) => { if (!(k.key in m)) m[k.key] = k.default; });
      setVals(m);
    })();
  }, []);
  const save = async () => {
    for (const k of SERVICE_FEE_KEYS) {
      const s = String(vals[k.key] ?? "").trim();
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return toast.error(`${k.label} Service fee must be a valid amount (e.g. 5.00)`);
    }
    const rows = Object.entries(vals).map(([key, value]) => ({
      key,
      value: (SERVICE_FEE_KEYS.some((k) => k.key === key) ? { value: Number(Number(value).toFixed(2)) } : value) as any,
    }));
    const { error } = await supabase.from("app_settings").upsert(rows);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };
  const devOn = String(vals.dev_mode_enabled ?? "false").toLowerCase() === "true";
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">System-wide configuration.</p></div>
      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-lg font-semibold">Service fee pricing</h2>
          <p className="text-sm text-muted-foreground">Service fee charged per order, based on the customer's property type. Applies to new orders only.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {SERVICE_FEE_KEYS.map((k) => (
            <div key={k.key}>
              <Label>{k.label} — Service fee (RM)</Label>
              <Input inputMode="decimal" value={vals[k.key] ?? ""} onChange={(e)=>setVals({ ...vals, [k.key]: e.target.value })} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4 max-w-2xl">
        {KEYS.map((k) => (
          <div key={k.key}>
            <Label>{k.label}</Label>
            <Input value={vals[k.key] ?? ""} onChange={(e)=>setVals({ ...vals, [k.key]: e.target.value })} />
          </div>
        ))}
      </Card>

      <Card className="p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-lg font-semibold">App Status / Development Mode</h2>
          <p className="text-sm text-muted-foreground">When enabled, a notice is shown to users every time they open the app.</p>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label>Development mode</Label>
            <p className="text-xs text-muted-foreground">{devOn ? "Active — notice is shown" : "Inactive"}</p>
          </div>
          <Switch checked={devOn} onCheckedChange={(c)=>setVals({ ...vals, dev_mode_enabled: c ? "true" : "false" })} />
        </div>
        <div>
          <Label>Notice title</Label>
          <Input value={vals.dev_mode_title ?? ""} onChange={(e)=>setVals({ ...vals, dev_mode_title: e.target.value })} />
        </div>
        <div>
          <Label>Notice message</Label>
          <Textarea rows={4} value={vals.dev_mode_message ?? ""} onChange={(e)=>setVals({ ...vals, dev_mode_message: e.target.value })} />
        </div>
        <div>
          <Label>Button text</Label>
          <Input value={vals.dev_mode_button ?? ""} onChange={(e)=>setVals({ ...vals, dev_mode_button: e.target.value })} />
        </div>
      </Card>

      <Button onClick={save}>Save settings</Button>
    </div>
  );
}

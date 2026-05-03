import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export default function MerchantInventory() {
  const { user } = useAuth();
  const { merchant } = useMerchantContext();
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", qty: 1, type: "in" as "in"|"out"|"adjustment", reason: "" });

  const load = () => merchant && supabase.from("products").select("*").eq("merchant_id", merchant.id).order("name").then(({ data }) => setProducts(data ?? []));
  useEffect(() => { load(); }, [merchant?.id]);

  const submit = async () => {
    if (!form.product_id || !form.qty) { toast.error("Select product and qty"); return; }
    const product = products.find((p) => p.id === form.product_id);
    const delta = form.type === "out" ? -Math.abs(form.qty) : form.type === "in" ? Math.abs(form.qty) : form.qty;
    const newQty = Math.max(0, Number(product.stock_qty) + delta);

    const { error: mErr } = await supabase.from("inventory_movements").insert([{
      product_id: form.product_id, merchant_id: merchant!.id, performed_by: user!.id,
      quantity: Math.abs(form.qty), type: form.type, reason: form.reason || null,
    }]);
    if (mErr) { toast.error(mErr.message); return; }
    const { error: pErr } = await supabase.from("products").update({ stock_qty: newQty }).eq("id", form.product_id);
    if (pErr) { toast.error(pErr.message); return; }
    toast.success("Inventory updated");
    setOpen(false); setForm({ product_id: "", qty: 1, type: "in", reason: "" }); load();
  };

  if (!merchant) return <p className="text-sm text-muted-foreground">No merchant linked.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New movement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Inventory movement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Product</Label>
                <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock_qty})</option>)}
                </select>
              </div>
              <div><Label>Type</Label>
                <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                  <option value="in">Stock in (add)</option>
                  <option value="out">Stock out (remove)</option>
                  <option value="adjustment">Adjustment (signed)</option>
                </select>
              </div>
              <div><Label>Quantity</Label><Input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></div>
              <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={200} /></div>
              <Button className="w-full" onClick={submit}>Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr className="text-left"><th className="p-3">Product</th><th className="p-3">Stock</th><th className="p-3">Reserved</th><th className="p-3">Threshold</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b"><td className="p-3">{p.name}</td><td className="p-3 font-bold">{p.stock_qty}</td><td className="p-3">{p.reserved_qty}</td><td className="p-3">{p.low_stock_threshold}</td>
                <td className="p-3">{p.stock_qty <= p.low_stock_threshold ? <span className="text-destructive">Low</span> : <span className="text-success">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";

export type CartItem = {
  product_id: string;
  merchant_id: string;
  name: string;
  image_url?: string | null;
  type: "refill" | "new" | "deposit";
  cylinder_size_kg?: number | null;
  unit_price: number;
  quantity: number;
};

const KEY = "gasbee_cart_v1";

function read(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("gasbee-cart"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(read());
  useEffect(() => {
    const h = () => setItems(read());
    window.addEventListener("gasbee-cart", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("gasbee-cart", h); window.removeEventListener("storage", h); };
  }, []);

  const add = useCallback((it: CartItem) => {
    const cur = read();
    // Cart locked to one merchant
    const filtered = cur.length && cur[0].merchant_id !== it.merchant_id ? [] : cur;
    const idx = filtered.findIndex((x) => x.product_id === it.product_id && x.type === it.type);
    if (idx >= 0) filtered[idx].quantity += it.quantity;
    else filtered.push(it);
    write(filtered);
  }, []);

  const setQty = useCallback((product_id: string, type: string, qty: number) => {
    const cur = read().map((x) => (x.product_id === product_id && x.type === type ? { ...x, quantity: qty } : x)).filter((x) => x.quantity > 0);
    write(cur);
  }, []);

  const remove = useCallback((product_id: string, type: string) => {
    write(read().filter((x) => !(x.product_id === product_id && x.type === type)));
  }, []);

  const clear = useCallback(() => write([]), []);

  const subtotal = items.reduce((s, x) => s + x.unit_price * x.quantity, 0);
  const count = items.reduce((s, x) => s + x.quantity, 0);

  return { items, add, setQty, remove, clear, subtotal, count };
}

import jsPDF from "jspdf";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import gasbeeMark from "@/assets/gasbee-mark.png";

export interface ReceiptOrder {
  code: string;
  created_at?: string | null;
  total_amount: number | string;
  items_subtotal: number | string;
  delivery_fee: number | string;
  service_fee?: number | string | null;
  processing_fee?: number | string | null;
  highrise_surcharge?: number | string | null;
  gas_exchange_type?: string | null;
  gas_exchange_fee?: number | string | null;
  discount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  address_snapshot?: any;
  delivery_type?: string | null; // "Asap", "Standard", etc.
  delivery_datetime?: string | null; // Delivery date/time
  merchants?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postcode?: string | null;
    state?: string | null;
  } | null;
}

export interface ReceiptItem {
  product_name: string;
  type?: string | null;
  quantity: number | string;
  unit_price: number | string;
  subtotal: number | string;
  // New fields for detailed item info
  deposit_amount?: number | string | null;
  refill_amount?: number | string | null;
  cylinder_size?: string | null; // e.g., "14KG", "12KG"
}

const money = (v: any) => `RM ${Number(v || 0).toFixed(2)}`;

const TYPE_LABEL: Record<string, string> = {
  refill: "LPG Refill",
  new_cylinder: "New Cylinder Gas",
  deposit: "Cylinder Deposit",
  accessory: "Accessories",
};

export function formatOrderItemName(it: {
  product_name?: string | null;
  type?: string | null;
  cylinder_size?: string | null;
  deposit_amount?: number | string | null;
  refill_amount?: number | string | null;
}): string {
  const name = (it.product_name ?? "").trim();
  // Accessories are stored as new_cylinder (no dedicated enum). The stored
  // name already starts with "Accessories, " — don't prepend "New Cylinder Gas".
  if (
    it.type === "new_cylinder" &&
    name.toLowerCase().startsWith("accessories")
  )
    return name;
  const label = it.type ? TYPE_LABEL[it.type] : null;

  if (!label) return name || "Item";
  if (!name) return label;
  // Skip if name already begins with the category label
  if (name.toLowerCase().startsWith(label.toLowerCase())) return name;
  return `${label}, ${name}`;
}

// Brand palette
const BRAND = {
  amber: [245, 158, 11] as [number, number, number], // primary amber
  ink: [17, 24, 39] as [number, number, number], // near-black
  body: [55, 65, 81] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  hair: [229, 231, 235] as [number, number, number],
  soft: [255, 251, 235] as [number, number, number], // light amber bg
};

async function loadImageDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function generateReceiptPdf(
  order: ReceiptOrder,
  items: ReceiptItem[],
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48; // margin

  // === HEADER BAND ===
  doc.setFillColor(...BRAND.ink);
  doc.rect(0, 0, pageW, 110, "F");
  // amber accent stripe
  doc.setFillColor(...BRAND.amber);
  doc.rect(0, 110, pageW, 4, "F");

  // Logo (mark)
  try {
    const logo = await loadImageDataUrl(gasbeeMark);
    doc.addImage(logo, "PNG", M, 28, 56, 46);
  } catch {
    // ignore
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Gasbee", M + 70, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 200, 100);
  doc.text("BE READY · BEE DELIVERS", M + 70, 72);

  // Right side: RECEIPT label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("RECEIPT", pageW - M, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 200, 100);
  doc.text(`No. ${order.code}`, pageW - M, 74, { align: "right" });
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.text(
    order.created_at ? new Date(order.created_at).toLocaleString() : "",
    pageW - M,
    88,
    { align: "right" },
  );

  // === SUMMARY SECTION (Like in the image) ===
  // Long values wrap to multiple lines inside the left column so they never
  // overlap the DELIVER TO column on the right.
  let y = 140;
  const summaryLabelX = M + 10;
  const summaryValueX = M + 110;
  const summaryValueMaxW = pageW / 2 + 20 - summaryValueX - 12; // stay clear of the right column

  const placeOnStr = order.created_at
    ? new Date(order.created_at).toLocaleString("en-MY", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";
  const deliveryTimeStr = order.delivery_datetime
    ? new Date(order.delivery_datetime).toLocaleString("en-MY", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";
  const paymentLabel =
    order.payment_method === "fpx"
      ? "fpx"
      : order.payment_method === "card"
        ? "card"
        : order.payment_method === "cod"
          ? "cod"
          : (order.payment_method ?? "-");

  const summaryData: { label: string; value: string }[] = [
    { label: "Order#:", value: String(order.code) },
    { label: "Place on:", value: placeOnStr },
    { label: "Order Total:", value: money(order.total_amount) },
    { label: "Delivery", value: order.delivery_type || "Asap" },
    { label: "Date/Time:", value: deliveryTimeStr },
    { label: "Payment method:", value: String(paymentLabel) },
  ];

  // Measure wrapped lines first so the background box fits the content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const summaryRows = summaryData.map((r) => ({
    ...r,
    lines: doc.splitTextToSize(r.value, summaryValueMaxW) as string[],
  }));
  const rowsHeight = summaryRows.reduce(
    (h, r) => h + Math.max(1, r.lines.length) * 14 + 4,
    0,
  );
  const summaryBoxH = 30 + rowsHeight + 8;
  const summaryBoxBottom = y - 12 + summaryBoxH;

  doc.setFillColor(...BRAND.soft);
  doc.rect(M, y - 12, pageW - M * 2, summaryBoxH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.ink);
  doc.text("Summary", summaryLabelX, y + 8);

  y += 30;
  summaryRows.forEach((r) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.body);
    doc.text(r.label, summaryLabelX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.ink);
    doc.text(r.lines, summaryValueX, y);
    y += Math.max(1, r.lines.length) * 14 + 4;
  });

  // === DELIVER TO SECTION (Right side of Summary) ===
  let deliverY = 140 + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.ink);
  doc.text("DELIVER TO", pageW / 2 + 20, deliverY);

  deliverY += 24;
  const a = order.address_snapshot ?? {};
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(a.recipient_name || "—", pageW / 2 + 20, deliverY);

  deliverY += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.body);
  if (a.recipient_phone)
    doc.text(String(a.recipient_phone), pageW / 2 + 20, deliverY);

  const addr = [a.address_line1, a.address_line2, a.postcode, a.city, a.state]
    .filter(Boolean)
    .join(", ");
  if (addr) {
    deliverY += 14;
    const lines = doc.splitTextToSize(addr, pageW / 2 - M - 30);
    doc.text(lines, pageW / 2 + 20, deliverY);
  }

  // === MERCHANT INFO (Below Summary) ===
  y = summaryBoxBottom + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text("MERCHANT", M, y);

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  doc.text(order.merchants?.name || "—", M, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.body);
  if (order.merchants?.phone) doc.text(String(order.merchants.phone), M, y);
  const mAddr = [
    order.merchants?.address,
    order.merchants?.postcode,
    order.merchants?.city,
    order.merchants?.state,
  ]
    .filter(Boolean)
    .join(", ");
  if (mAddr) {
    const ml = doc.splitTextToSize(mAddr, pageW / 2 - M - 10);
    doc.text(ml, M, y + 14);
    y += 14 + ml.length * 11; // advance y past the address lines
  } else {
    y += 14;
  }

  // === ITEMS TABLE ===
  y += 28;
  doc.setFillColor(...BRAND.soft);
  doc.rect(M, y - 14, pageW - M * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.ink);
  doc.text("ITEMS ORDERED", M + 10, y);
  doc.text("QTY", pageW - M - 180, y, { align: "right" });
  doc.text("UNIT", pageW - M - 90, y, { align: "right" });
  doc.text("SUBTOTAL", pageW - M - 10, y, { align: "right" });
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.body);
  items.forEach((it, i) => {
    // Reset font for each item (breakdown rows use smaller font)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Plain product name to match the web order detail card
    const nameLines = doc.splitTextToSize(
      (it.product_name ?? "").trim() || "Item",
      pageW - M * 2 - 220,
    );
    let rowH = Math.max(18, nameLines.length * 13);

    // Check if this is a new cylinder with breakdown details
    const hasBreakdown =
      it.type === "new_cylinder" && (it.deposit_amount || it.refill_amount);

    if (i % 2 === 1 && !hasBreakdown) {
      doc.setFillColor(250, 250, 250);
      doc.rect(M, y - 12, pageW - M * 2, rowH, "F");
    }

    // Main item name
    doc.setTextColor(...BRAND.ink);
    doc.text(nameLines, M + 10, y);
    doc.setTextColor(...BRAND.body);
    doc.text(String(it.quantity), pageW - M - 180, y, { align: "right" });
    doc.text(money(it.unit_price), pageW - M - 90, y, { align: "right" });
    doc.setTextColor(...BRAND.ink);
    doc.text(money(it.subtotal), pageW - M - 10, y, { align: "right" });
    y += rowH;

    // If new cylinder with breakdown, show price details
    if (hasBreakdown) {
      const indentX = M + 20;
      const smallFont = 9;

      // New cylinder deposit - deposit amount
      if (it.deposit_amount) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(smallFont);
        doc.setTextColor(...BRAND.body);
        doc.text("· New cylinder deposit", indentX, y);
        doc.text(money(it.deposit_amount), pageW - M - 90, y, {
          align: "right",
        });
        y += 14;
      }

      // Refill (gas) - refill amount
      if (it.refill_amount) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(smallFont);
        doc.setTextColor(...BRAND.body);
        doc.text("· Refill (gas)", indentX, y);
        doc.text(money(it.refill_amount), pageW - M - 90, y, {
          align: "right",
        });
        y += 14;
      }
    }
  });

  // === TOTALS ===
  y += 10;
  doc.setDrawColor(...BRAND.hair);
  doc.line(pageW - M - 240, y, pageW - M, y);
  y += 16;

  const totalsRow = (
    label: string,
    value: string,
    opts?: { bold?: boolean; color?: [number, number, number] },
  ) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.bold ? 12 : 10);
    doc.setTextColor(...(opts?.color ?? BRAND.body));
    doc.text(label, pageW - M - 240, y);
    doc.text(value, pageW - M - 10, y, { align: "right" });
    y += opts?.bold ? 18 : 15;
  };
  totalsRow("Subtotal", money(order.items_subtotal));
  totalsRow("Delivery Fee", money(order.delivery_fee));
  if (Number(order.service_fee || 0) > 0)
    totalsRow("Service Fee", money(order.service_fee));
  if (Number(order.processing_fee || 0) > 0)
    totalsRow("Processing Fee", money(order.processing_fee));
  if (Number(order.highrise_surcharge || 0) > 0)
    totalsRow("High-Rise Delivery Surcharge", money(order.highrise_surcharge));
  if (order.gas_exchange_type)
    totalsRow(
      `Gas Exchange (${order.gas_exchange_type === "non_petronas" ? "Non-Petronas" : "Petronas"})`,
      money(order.gas_exchange_fee || 0),
    );
  if (Number(order.discount || 0) > 0)
    totalsRow("Discount", `- ${money(order.discount)}`);

  // grand total band
  y += 4;
  doc.setFillColor(...BRAND.ink);
  doc.rect(pageW - M - 250, y - 4, 250, 32, "F");
  doc.setFillColor(...BRAND.amber);
  doc.rect(pageW - M - 250, y - 4, 4, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL PAID", pageW - M - 235, y + 16);
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.amber);
  doc.text(money(order.total_amount), pageW - M - 10, y + 17, {
    align: "right",
  });
  y += 40;

  // === PAYMENT BADGE ===
  y += 14;
  const status = (order.payment_status ?? "-").toUpperCase();
  const method =
    order.payment_method === "fpx"
      ? "FPX (Online Transfer)"
      : order.payment_method === "card"
        ? "Credit Card"
        : order.payment_method === "cod"
          ? "COD (Cash on Delivery)"
          : (order.payment_method ?? "-").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text("PAYMENT", M, y);
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  doc.text(`${method} · ${status}`, M, y);

  // === FOOTER ===
  const footY = pageH - 60;
  doc.setDrawColor(...BRAND.hair);
  doc.line(M, footY, pageW - M, footY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  doc.text("Thank you for ordering with Gasbee", M, footY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    "This receipt was generated automatically. For support, contact your merchant.",
    M,
    footY + 32,
  );
  doc.text("gasbee.com.my", pageW - M, footY + 32, { align: "right" });

  return doc;
}

export async function downloadReceipt(orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, merchants(name, phone, address, city, postcode, state)")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new Error(error?.message || "Order not found");

  // Fetch order items WITH product details for price breakdown
  const { data: items } = await supabase
    .from("order_items")
    .select(
      `
      *,
      products (
        new_cylinder_price,
        refill_price,
        deposit_amount,
        cylinder_size_kg
      )
    `,
    )
    .eq("order_id", orderId);

  // Transform items to include breakdown data for receipt
  const receiptItems = (items ?? []).map((it: any) => {
    const product = it.products || {};
    return {
      product_name: it.product_name,
      type: it.type,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      // Map product data to receipt format
      cylinder_size: it.cylinder_size_kg
        ? `${it.cylinder_size_kg}KG`
        : product.cylinder_size_kg
          ? `${product.cylinder_size_kg}KG`
          : null,
      deposit_amount:
        product.deposit_amount || product.new_cylinder_price || null,
      refill_amount: product.refill_price || null,
    };
  });

  const doc = await generateReceiptPdf(order as any, receiptItems);
  const filename = `Receipt-${(order as any).code}.pdf`;

  // jsPDF's save() relies on the browser's <a download> + blob behaviour,
  // which does nothing inside the native WebView — write the file and open
  // the share sheet instead so the user can save or send the receipt.
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = doc.output("datauristring").split(",")[1] ?? "";
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: result.uri });
    return;
  }

  doc.save(filename);
}

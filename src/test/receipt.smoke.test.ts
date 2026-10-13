import { describe, expect, it } from "vitest";
import { formatOrderItemName, generateReceiptPdf } from "@/lib/receipt";

const DB_TYPES = ["refill", "new_cylinder", "deposit"] as const;

/** Mirrors UserCheckout insert mapping. Must stay inside the live DB enum. */
function toDbType(cartType: "refill" | "new" | "deposit") {
  const type = cartType === "new" ? "new_cylinder" : cartType;
  if (!(DB_TYPES as readonly string[]).includes(type)) {
    throw new Error(`invalid input value for enum order_item_type: "${type}"`);
  }
  return type;
}

describe("order item smoke", () => {
  it("maps cart types onto the existing enum only", () => {
    expect(toDbType("new")).toBe("new_cylinder");
    expect(toDbType("refill")).toBe("refill");
    expect(toDbType("deposit")).toBe("deposit");
  });

  it("does not label accessories as New Cylinder Gas", () => {
    expect(
      formatOrderItemName({
        type: "new_cylinder",
        product_name: "Accessories, Gas Kit + Inspection + Installation",
      }),
    ).toBe("Accessories, Gas Kit + Inspection + Installation");
  });

  it("keeps the cylinder label", () => {
    expect(
      formatOrderItemName({ type: "new_cylinder", product_name: "Gas 12kg" }),
    ).toBe("New Cylinder Gas, Gas 12kg");
  });

  it("wraps a long Place on date instead of overflowing the summary column", async () => {
    const doc = await generateReceiptPdf(
      {
        code: "GB-SMOKE",
        created_at: "2026-10-12T06:20:00.000Z",
        total_amount: 404.9,
        items_subtotal: 380,
        delivery_fee: 24.9,
        payment_method: "fpx",
        payment_status: "paid",
        address_snapshot: {
          recipient_name: "Aiman",
          recipient_phone: "01111106310",
          address_line1: "Jalan Test",
          postcode: "43000",
          city: "Kajang",
          state: "Selangor",
        },
        merchants: { name: "Gasbee Kajang", phone: "01100000000" },
      },
      [
        {
          product_name: "Accessories, Gas Kit + Inspection + Installation",
          type: "new_cylinder",
          quantity: 1,
          unit_price: 25,
          subtotal: 25,
        },
        {
          product_name: "Gas 14kg",
          type: "new_cylinder",
          quantity: 1,
          unit_price: 106.6,
          subtotal: 106.6,
          deposit_amount: 80,
          refill_amount: 26.6,
        },
      ],
    );

    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    const shown = [...raw.matchAll(/\((?:\\\)|[^)])*\)/g)]
      .map((m) => m[0].slice(1, -1))
      .join("\n");

    expect(shown).toContain("GB-SMOKE");
    expect(shown).toContain("Payment method:");
    expect(shown).toContain("New cylinder deposit");
    expect(shown).toContain("Refill \\(gas\\)");
    expect(shown).not.toContain("Unit price");
    expect(shown).not.toContain("New Cylinder Gas, Accessories");

    // Place-on date must stay inside the summary column (page is ~595pt wide).
    const dateX = [...raw.matchAll(/([\d.]+) ([\d.]+) Td\n\(Mon,/g)].map((m) => Number(m[1]));
    expect(dateX.length).toBeGreaterThan(0);
    expect(Math.max(...dateX)).toBeLessThan(320);
  });
});

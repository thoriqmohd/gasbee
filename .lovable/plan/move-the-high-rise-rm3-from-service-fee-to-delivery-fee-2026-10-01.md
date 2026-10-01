# Move the High-Rise RM3 from Service fee to Delivery fee

The current setup stays: property type, Floor/Unit fields, older-address prompt, address switching, admin-only access and audit logs. Only the pricing changes.

## What changes for the customer
- Service fee is the same for Landed and High-Rise (RM5.00 today).
- High-Rise Delivery fee = normal delivery fee + High-Rise surcharge (RM3.00 by default). Example: RM6.00 becomes RM9.00.
- Checkout lines stay the same: Subtotal, Service fee, Delivery fee, Processing fee, Total. There is no extra line and no "surcharge" wording.
- Switching address updates the Delivery fee and Total straight away.

## Admin
- The "Service fee pricing" section becomes one field: Service fee (RM).
- A new "Delivery fee settings" section has "High-Rise Delivery Surcharge" (RM, default 3.00). Same rules as before: a number, 0 or more, at most 2 decimals.
- The High-Rise Service fee field (RM8.00) is removed.
- Changes to the surcharge go in Audit Logs: old value, new value, admin and time.

## No double charge
- The RM3 is taken out of the Service fee everywhere, in both the app and the server.
- Past orders keep what they were charged.

## Technical details
- Migration:
  - Add `app_settings.highrise_delivery_surcharge = 3`. Delete the `service_fee_highrise` row.
  - In `get_public_fee_settings`, replace `service_fee_highrise` with `highrise_delivery_surcharge`.
  - In `order_insert_guard`:
    - `service_fee := setting_numeric('service_fee', 5)` for every property type.
    - `base := LEAST(GREATEST(COALESCE(client_fee, 0), delivery_base_fee), 500)`, which is the same clamp as today.
    - `delivery_fee := base + (highrise ? setting_numeric('highrise_delivery_surcharge', 3) : 0)`.
    - The app sends the base fee. The server adds the surcharge, so it can only be applied once.
  - In `audit_service_fee_pricing`, track `service_fee` and `highrise_delivery_surcharge`, with action `delivery_surcharge_changed` for the surcharge.
  - `order_recalc_totals` already uses the stored `delivery_fee`, so it needs no change.
- `src/lib/delivery.ts`: replace `serviceFeeHighrise` with `highriseDeliverySurcharge` (default 3).
- `UserCheckout.tsx`:
  - `serviceFee = feeConfig.serviceFee`.
  - Show `deliveryFee = feeCalc.fee + (highrise ? surcharge : 0)` and use it in the total.
  - Send the base `feeCalc.fee` as `delivery_fee`.
- Admin `Settings.tsx`: update the sections as described above.
- Verify:
  - Landed: RM5 + RM6. High-Rise: RM5 + RM9.
  - Switching address back and forth.
  - Surcharge changed to RM5: High-Rise delivery is RM11, Landed stays RM6, and old orders are unchanged.
  - The audit log row is written.

# Service fee by property type (Landed / High-Rise)

## What the customer sees
- **Add/Edit address:** a required "Property Type" choice: Landed (terrace, semi-D, bungalow, townhouse) or High-Rise (apartment, condo, flat, service residence).
  - High-Rise also shows Floor / Tingkat and Unit / No. Rumah, and both are required. Landed customers are not asked for them.
- **Saved addresses list:** each address shows a Landed or High-Rise label and a matching icon.
- **Checkout:** same lines as today (Subtotal, Service fee, Delivery fee, Processing fee, Total).
  - Service fee shows the Landed or High-Rise price for the selected address. There is no extra line and no "RM3".
  - The fee updates straight away when the customer changes address.
- **Older address with no type:** at checkout, a prompt asks "Jenis kediaman?" with Landed or High-Rise. The answer is saved to that address, so the customer is never asked again. Ordering is blocked until they answer.

## Admin
- Admin Settings gets a "Service fee pricing" section with two fields: Landed (default RM5.00) and High-Rise (default RM8.00).
  - The existing "Service fee" setting becomes the Landed price, so the current RM5.00 stays.
- Validation: must be a number, 0 or more, at most 2 decimals. Empty, negative or text values are rejected.
- Only admins can change prices. The database already blocks everyone else.
- Every change is written to the existing Audit Logs: old and new Landed price, old and new High-Rise price, which admin, and when.
- New orders use the new price straight away, with no app update. Past orders keep the fee they were charged.

## Payouts (no change)
- Merchant payout already takes off the Service fee, the same as today. So the extra High-Rise amount stays with Gasbee. Tell me if the merchant should get it instead.

## Technical details
- Migration:
  - `addresses`: add `property_type text NULL` (checked to `landed` or `highrise`), `floor text NULL`, `unit_no text NULL`. Existing rows stay NULL.
  - `app_settings`: add `service_fee_highrise = 8`. Keep `service_fee` as the Landed price (single source). Add the new key to `get_public_fee_settings`.
  - `order_insert_guard`:
    - Read `address_snapshot->>'id'` and load that address, checking `user_id = auth.uid()`.
    - Raise an error if it is not found or `property_type` is NULL.
    - Set `service_fee` from `service_fee` (landed) or `service_fee_highrise`. The browser's value is ignored, and `order_recalc_totals` already uses the stored value.
    - Also store `property_type` in the snapshot.
  - Audit trigger on `app_settings`: when `service_fee` or `service_fee_highrise` changes, insert into `audit_logs` (action `service_fee_pricing_changed`, old and new values, `actor_id = auth.uid()`).
- `UserAddresses.tsx`: property type cards, conditional floor/unit, validation, and a label in the list.
- `UserCheckout.tsx`:
  - Read both prices from settings and pick by the selected address.
  - Show the "Jenis kediaman?" dialog for addresses with no type and save the answer to the address.
  - Make the address switchable at checkout. Today it shows the default address only, so add a selector.
  - `src/lib/delivery.ts`: add `serviceFeeHighrise` to `FeeConfig`.
- Admin `Settings.tsx`: a "Service fee pricing" section with Landed and High-Rise fields, plus validation before save.
- No changes to delivery fee, processing fee, gas exchange charge, promotions, CHIP, or settlements.
- Verify:
  - Landed, High-Rise and address-switch totals.
  - The prompt for addresses with no type.
  - After an admin price change: new orders get the new fee, old orders are unchanged, and an audit log row exists.
  - A non-admin cannot change the price.

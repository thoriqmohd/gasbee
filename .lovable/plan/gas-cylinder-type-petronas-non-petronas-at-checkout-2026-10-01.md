# Gas Cylinder Type (Petronas / Non-Petronas) at checkout

## What the customer sees
- At checkout, if the cart has any LPG Refill item, a "Gas Cylinder Type" section appears: "Please select the type of gas cylinder currently used at your home." Options: Petronas / Non-Petronas.
- Checkout is blocked until one is picked.
- Petronas: Gas Exchange Charge RM0.00. Non-Petronas: RM3.00 for each LPG Refill cylinder (e.g. 2 refills = RM6.00).
- New Cylinder only: section hidden, no charge. Mixed cart: section shown, charge counts only the refill cylinders.
- No brand names and no free-text field. Nothing is saved to the profile or addresses. The customer picks again on every order.

## Where it shows
- Checkout summary, customer order detail, and receipt: a separate "Gas Exchange Charge" line.
- Merchant and admin order detail: Gas Cylinder Type and Gas Exchange Charge.
- Rider job detail: Gas Cylinder Type only.

## Money flow
- Total = Subtotal + Delivery + Service + Processing + Gas Exchange - Discount/Credits.
- CHIP charges the stored order total, so the charge is included automatically. The payment connection itself is not changed.
- Merchant payout: the charge goes to the merchant. It is added to settlement gross and not deducted like service or processing fees.

## Technical details
- Migration:
  - Add `orders.gas_exchange_type text NULL`, checked to `petronas` or `non_petronas`.
  - Add `orders.gas_exchange_fee numeric NOT NULL DEFAULT 0`.
  - Add the setting `gas_exchange_fee = 3.00` in app_settings, and expose it through `get_public_fee_settings`.
- `order_insert_guard`: for customers, force `gas_exchange_fee = 0` on insert. Keep the type, limited to the allowed values.
- `order_recalc_totals`:
  - Count refill-type cylinders on the order: item type `refill`, or LPG Refill category.
  - Fee = `setting_numeric('gas_exchange_fee', 3)` × refill qty when type is `non_petronas`, else 0. Require a type when refill items exist.
  - Write `gas_exchange_fee` and add it into `total_amount`.
  - Promotions keep using the items subtotal only (unchanged).
- `orders_customer_update_guard`: block customer changes to `gas_exchange_type` and `gas_exchange_fee`.
- Files:
  - `UserCheckout.tsx`: section, validation, total, and sending the type.
  - `UserOrderDetail.tsx`, `MerchantOrderDetail.tsx`, admin `OrderDetail.tsx`, `RiderJobDetail.tsx`: display.
  - `src/lib/receipt.ts`: receipt line.
  - Admin `Settings.tsx`: editable fee field.
- Settlements: check how gross is computed. If it already uses order totals, the charge flows to the merchant with no change. Otherwise, add `gas_exchange_fee` into gross.
- Verify:
  - Order scenarios: Petronas, Non-Petronas ×2, New Cylinder only, mixed cart, with promo.
  - Check the stored total matches the amount sent to CHIP.

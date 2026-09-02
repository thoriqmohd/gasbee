# Prefix Test Merchant Names with "TEST - "

## Goal
Mark the existing test merchants in the database by prefixing their names with `TEST - `, so they are clearly identifiable in the user app and admin panel.

## Affected merchants (from the user app home listing)
- Rizq S Enterprise → `TEST - Rizq S Enterprise`
- SN Gas Sdn Bhd → `TEST - SN Gas Sdn Bhd`
- Synchronetwork Sdn Bhd → `TEST - Synchronetwork Sdn Bhd`

## Changes
1. Query the `merchants` table to confirm the exact rows for these three merchants (name or slug match).
2. Run a data update (SQL UPDATE on `merchants.name`) to prefix each name with `TEST - `.
   - Only rows whose name does not already start with `TEST - ` will be updated (idempotent).
   - Slugs are not changed, so existing links keep working.
3. Verify by re-reading the rows after the update.

## Notes
- No code changes required — the new names appear automatically everywhere merchants are listed (user app home, merchant detail, admin Merchants page).
- Reversible anytime by removing the prefix.

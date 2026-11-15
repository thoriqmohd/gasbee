# CHIP payment checks

Run the handler tests with Node.js 24 or later. Requests are mocked and use generated signature keys.

```sh
node --test supabase/tests/chip/create.test.ts supabase/tests/chip/webhook.test.mjs
```

Run the atomic database tests with PGlite installed in an isolated temporary directory. The fixture uses an in-memory PostgreSQL database.

```sh
test_runtime="$(mktemp -d)"
npm install --prefix "$test_runtime" --no-save @electric-sql/pglite@0.3.14
NODE_PATH="$test_runtime/node_modules" node supabase/tests/chip/database.cjs
NODE_PATH="$test_runtime/node_modules" node supabase/tests/chip/web-order.cjs
```

## Sandbox and production deployment

1. Apply the payment reservation, callback, and atomic web checkout migrations in an isolated Supabase project. Seed a synthetic merchant, buyer, saved address and product. Point the test website build at the isolated project.
2. In CHIP Developers, switch to Test Mode and configure the separate CHIP Collect test key in the isolated environment. Check the returned purchase is marked `is_test: true` before continuing to the simulator. The ordinary purchase callback uses the company's signing key obtained from CHIP. If the same endpoint also receives registered webhooks, set `CHIP_REGISTERED_WEBHOOK_PUBLIC_KEYS` to a JSON array of those public keys.
3. Deploy `chip-webhook` and then `chip-create-purchase` to that project. Create payments through the portal, V2 web, and native return paths. Confirm the actual provider signature, checkout URL, and repeat callback behavior. The sandbox callback must leave the order unchanged. The database fixture above tests the paid transition. Verify losing the creation response leaves the order in a state operations can reconcile before attempting payment again. The callback can verify authentic test purchases and intentionally ignores their paid state; assert actual paid state transitions separately in the isolated SQL fixture.
4. Apply and deploy the same items in the same order in production after the sandbox checks. Verify function versions and monitor definitive provider responses and orders requiring reconciliation. The managed frontend publish action does not verify the Edge Function versions.

After verifying the production function versions, enable portal checkout separately on the website. For the portal return, the gateway accepts HTTPS URLs on the configured origins with the matching order ID and payment result.

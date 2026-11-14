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
```

## Sandbox and production deployment

1. Apply the payment reservation migration, then the callback migration in an isolated Supabase project.
2. Configure CHIP sandbox credentials. The ordinary purchase callback uses the company's signing key obtained from CHIP. If the same endpoint also receives registered webhooks, set `CHIP_REGISTERED_WEBHOOK_PUBLIC_KEYS` to a JSON array of those public keys.
3. Deploy `chip-webhook` and then `chip-create-purchase` to that project. Create payments through the V2 web and native return paths. Confirm the actual provider signature, checkout URL, paid transition, and repeat callback behavior. Exercise a top-up with the configured brand and mode if the project uses that path. Verify losing the creation response leaves the order in a state operations can reconcile before attempting payment again.
4. Apply and deploy the same items in the same order in production after the sandbox checks. Verify function versions and monitor definitive provider responses and orders requiring reconciliation. The managed frontend publish action does not verify the Edge Function versions.

The production website checkout suspension is controlled separately by the website. The shared V2 function blocks the website order return path as an additional check. Channel separation requires a server-enforced rule before re-enabling website checkout because both clients use the same authentication service.

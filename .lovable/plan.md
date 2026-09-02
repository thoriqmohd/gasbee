# Fix Apple Rejection: Guest Browsing + Camera Crash

Two blocking issues from App Review, fixed together.

## 1. Guest browsing (no forced login)

Today every `/user/*` page sits behind `ProtectedRoute`, so opening the app immediately redirects to login. Backend access is also authenticated-only: `products`, `categories`, `banners` have policies for the `authenticated` role only, and the `anon` role currently has no table grants at all in the public schema (verified).

New flow:

```text
Open App -> Browse Products -> Product Detail -> Add to Cart -> Login/Register -> Checkout
```

Public (no login): Home, Products list & search, Merchants list, Merchant detail, Product detail, Cart.
Login required: Checkout, Orders / Order detail / Tracking, Notifications, Profile, Account Settings, Addresses, Support, Refund, Apply Merchant, Company Verification.

Behaviour details:
- App entry `/user` and `/user/home` render for guests; the bee intro animation stays tied to a real login.
- Cart already lives in localStorage, so a guest can add items; on "Checkout" the app sends them to Login/Register and returns them to checkout after a successful sign-in.
- Tab bar stays visible for guests; tapping Orders / Alerts / Profile routes to login with a return path.
- Profile tab for a guest shows a short "Sign in to manage your account" screen with Login and Register buttons instead of a hard redirect.
- Development-mode notice still shows for guests.

## 2. "Take Photo" crash on iOS

`src/components/ImageUpload.tsx` uses an HTML `<input type="file" capture="environment">`. Inside the iOS WKWebView this is the known crash path when the native camera usage descriptions are missing, and it gives no permission or cancel handling.

Fix:
- Add `@capacitor/camera` and use it whenever the app runs natively (`Capacitor.isNativePlatform()`); keep the existing file input as the web fallback.
- Explicit permission flow: check, request, and if denied show a clear message pointing to iOS Settings instead of crashing.
- Handle user cancel silently (no error toast, no thrown exception), wrap all camera calls in try/catch, and guard the upload path so a failed capture never leaves the UI stuck in "Uploading...".
- Capture at limited resolution/quality, then run the existing client-side compression before upload.
- Document the required iOS `Info.plist` keys (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) and Android camera permission, since those live in the exported native projects.
- Also remove the hardcoded `server.url` hot-reload block from `capacitor.config.ts` guidance for release builds, since a store build must not load the sandbox preview URL.

## Technical changes

Database migration (guest read access):
- `GRANT SELECT` to `anon` on `categories`, `banners`, `products`, and the `merchants_public` / `riders_public` views.
- Extend the existing SELECT policies to include the `anon` role for: active products, categories, active banners.
- `GRANT EXECUTE` on `get_public_fee_settings()` to `anon`.
- No change to orders, payments, profiles, or any user-scoped table.

Frontend:
- `src/App.tsx`: split the `/user` route group into a public group (wrapped in a new `UserPublicLayout` route element that renders `UserLayout` without `ProtectedRoute`) and a protected group for account features.
- New `src/components/user/GuestGate.tsx` (or equivalent): small component/helper that redirects to `/user/login` with `state.from` for guest-triggered account actions.
- `src/components/auth/LoginCard.tsx`: after login, honour `location.state.from` so the user returns to checkout.
- `src/components/user/UserLayout.tsx`: keep as-is visually; header/cart work for guests.
- `src/pages/user/UserCart.tsx`: checkout button routes guests to login with return path.
- `src/pages/user/UserProfile.tsx`: guest state.
- `src/components/ImageUpload.tsx`: native camera path via `@capacitor/camera` with full permission/cancel handling.

After the change: run the build, verify guest browsing in the preview (home, products, product detail, add to cart, redirect at checkout), and confirm logged-in flows are unchanged.

Note: the iOS `Info.plist` edits and a Release/TestFlight test must be done in your exported native project after `git pull` and `npx cap sync`; the exact keys and values will be listed at the end.

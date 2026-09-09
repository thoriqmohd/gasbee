# Fix admin login access

## What I found

The admin sign-in page is not where you were told to look:

- The admin login page lives at **`/login`** (not `/admin/login`). Opening `/admin/login` matches nothing, so you never see the admin sign-in form.
- Signing in with an admin account on the **user** login page (`/user/login`) is rejected on purpose — that page only accepts customer accounts and signs you straight back out.
- The accounts themselves are healthy. Checked in the database:
  - `support@synchronet.com.my` — Super Admin, active, confirmed, and it successfully signed in today at 08:14 UTC.
  - `sevencircleventure@gmail.com` — Admin, active, confirmed.
  - `roslanlogan94@gmail.com` — Super Admin but **disabled/banned**, so it cannot sign in.
- Database permissions and the role lookup used at sign-in are all correct, so nothing is blocking the admin role check.

## What to change

1. Add friendly admin URLs so both work:
   - `/admin/login` → shows the admin sign-in page (same page as `/login`).
   - `/admin` → sends signed-in admins to the dashboard, otherwise to admin login.
2. Keep `/login` working as it does today so nothing existing breaks.
3. Optional (say the word): set a fresh temporary password for `support@synchronet.com.my` so you can sign in immediately, and you change it afterwards.

## About the password

I can see which accounts are admins, but passwords are stored encrypted and cannot be read by anyone — not even from the backend. So I cannot tell you the existing admin password. Two ways forward:

- Use "Forgot password?" on the admin sign-in page with `support@synchronet.com.my`, or
- Let me set a temporary password for that account and I'll give it to you here.

## Technical notes

- `src/App.tsx`: add `<Route path="/admin/login" element={<AdminLogin />} />` and an `/admin` redirect element that uses the existing auth state (dashboard when the signed-in user has an admin role, otherwise the login page).
- No change needed to `ProtectedRoute`, `useAuth`, `LoginCard`, RLS policies, or grants.

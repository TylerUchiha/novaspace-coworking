# Production smoke test (manual)

Run on `https://novaspace.work` after a deploy you approve. Do not use bare `localhost` for phone SMS.

## 1. Signup

1. Create a new account (Google or email/password).
2. Open Profile.
3. **Expect:** email and phone show unverified (Firestore flags, not Google Auth).

## 2. Email OTP

1. Start email verification and enter the OTP.
2. Hard refresh (`Ctrl+Shift+R`).
3. Log out and log back in.
4. **Expect:** email stays Verified (green).

## 3. Phone SMS

1. Enter a valid national number and tap **Verify Phone Number**.
2. Tap **Send** (manual), enter the SMS code.
3. Hard refresh.
4. **Expect:** phone stays Verified; `confirmPhoneVerified` wrote Firestore (client cannot forge the flag).

## 4. Book → cancel

1. Pick a vendor/branch/room and create a booking (credits or free room as configured).
2. Cancel from My Bookings (or staff tools if applicable).
3. **Expect:** reservation appears, then cancels / updates per current policy.

## 5. Delete account

1. Profile → **Delete my account** → confirm.
2. **Expect:** signed out; Auth user gone; `users/{uid}` wiped (related data per `wipeUserData`).

## 6. Staff FCM

1. Sign in as owner/employee (passcode or staff code).
2. Allow browser notifications if prompted.
3. **Expect:** if VAPID/permission OK, a doc under `users/{uid}/fcmTokens/` appears.

## 7. Forge `phoneVerified` (security)

1. Sign in as a customer with DevTools.
2. Attempt a client `setDoc`/`updateDoc` merge `{ phoneVerified: true }` on your user doc.
3. **Expect:** `permission-denied`.

## 8. Analytics consent

1. Clear site data or use a fresh profile so `novaspace_analytics_consent` is unset.
2. First visit shows the consent banner.
3. **Accept analytics** → monitoring/analytics may init; **Essential only** → analytics stay off.
4. Profile → **Privacy preferences** can change the choice later.

## Catalog note

If the network list is empty, production Firestore has no vendors yet — create real venues in owner Property Config / Create Space. Do not clear `meta/catalog` to force a demo re-seed.

# Production smoke test (manual)

Run on `https://novaspace.work` after a deploy you approve.

## 1. Signup

1. Create a new account (Google or email/password).
2. Open Profile.
3. **Expect:** email and phone show unverified (Firestore flags, not Google Auth).

## 2. Email OTP

1. Start email verification and enter the OTP.
2. Hard refresh (`Ctrl+Shift+R`).
3. Log out and log back in.
4. **Expect:** email stays Verified (green).

## 3. Phone (WhatsApp OTP)

1. Ensure WhatsApp secrets + approved Meta Authentication template (see `docs/WHATSAPP_SETUP.md`).
2. Profile → Verify phone → **Send WhatsApp code**.
3. Enter the 6-digit code from WhatsApp.
4. Hard refresh.
5. **Expect:** phone stays Verified; `verifyWhatsAppCode` wrote Firestore (client cannot forge the flag).

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

## 8. Analytics

1. Privacy preference UI and cookie banner are not shown.
2. Fresh profiles get analytics/monitoring by default; prior `rejected` consent stays off.

## Catalog note

If the network list is empty, production Firestore has no vendors yet — create real venues in owner Property Config / Create Space. Do not clear `meta/catalog` to force a demo re-seed.

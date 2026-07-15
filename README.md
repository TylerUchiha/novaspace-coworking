# Nova Space

Production app for booking coworking desks and rooms (`novaspace.work`).

## Local development

```bash
npm install
npm --prefix functions install
cp .env.production.example .env.local   # optional local keys
npm run dev
```

Phone SMS verification uses Firebase Phone Auth. Use `https://novaspace.work` or `http://127.0.0.1` (not bare `localhost`).

## Production deploy

```bash
# Preferred: hosting + Firestore/Storage rules + Cloud Functions
npm run deploy:production
```

Order matters for phone verification: **rules + functions must ship together** (`phoneVerified` is server-only).

If a full functions deploy hits **Cloud Run CPU quota** in `us-central1`, deploy in small batches (one or a few functions at a time) and retry after cool-down.

Manual / one-time (not every deploy):

1. Secrets → `npm run setup:secrets` then `npm run functions:deploy` if secrets changed
2. Remote Config → `npm run deploy:remote-config`
3. Email extension SMTP → `node scripts/set-titan-smtp-secret.mjs` (or equivalent)
4. Custom domain / Auth authorized domains → `npm run connect:domain` / Firebase Console

CI (`.github/workflows/deploy.yml`) needs `FIREBASE_TOKEN` or `FIREBASE_SERVICE_ACCOUNT`, plus build secrets:

| GitHub secret | Purpose |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | Required for production login (fail-closed if missing) |
| `VITE_APPCHECK_SITE_KEY` | Optional App Check (fail-soft if missing) |
| `VITE_FIREBASE_VAPID_KEY` | Optional staff Web Push (shift reminders) |

Copy `.env.production.example` → `.env.production` for local production builds (gitignored).

---

## Ops verification runbook (checkboxes)

### Phone SMS

- [ ] Auth authorized domains include `novaspace.work`, `www.novaspace.work`, and `127.0.0.1`
- [ ] Phone provider enabled; Egypt (+20) allowed if needed (`npm run configure:phone-auth`)
- [ ] Blaze billing enabled (required for production SMS)
- [ ] Test on `https://novaspace.work` or `http://127.0.0.1` (never bare `localhost`)
- [ ] After `auth/too-many-requests`, wait for project cooldown (often hours); the app enforces a 1-hour local cooldown and does not auto-retry
- [ ] Dev: optional Firebase Console test phone numbers + `VITE_PHONE_AUTH_TEST_MODE=true`
- [ ] Send SMS → code → profile shows Verified; hard refresh stays verified
- [ ] Client forge of `phoneVerified: true` is denied (`permission-denied`)
- [ ] `confirmPhoneVerified` Cloud Function is live (rules lock client writes)

### Support email

- [ ] Extension `firestore-send-email` deployed
- [ ] SMTP secret configured (`scripts/set-titan-smtp-secret.mjs` or Console)
- [ ] Smoke: Support form → `mail` collection → inbox

### Function secrets (Secret Manager)

- [ ] `GEMINI_API_KEY` (Nova bot / AI)
- [ ] `RECAPTCHA_SECRET_KEY` (server verify for login)
- [ ] `OWNER_PASSCODE` (owner staff login)
- [ ] Confirm login reCAPTCHA, owner passcode, and Nova bot still work

```bash
npm run setup:secrets -- GEMINI_API_KEY "<key>"
npm run setup:secrets -- RECAPTCHA_SECRET_KEY "<secret>"
npm run setup:secrets -- OWNER_PASSCODE "<passcode>"
```

### GitHub Actions

- [ ] `FIREBASE_TOKEN` or `FIREBASE_SERVICE_ACCOUNT`
- [ ] `VITE_RECAPTCHA_SITE_KEY` (required for prod login fail-closed)
- [ ] Optional: `VITE_APPCHECK_SITE_KEY`, `VITE_FIREBASE_VAPID_KEY`

### App Check (fail-soft; Monitor first)

- [ ] Register reCAPTCHA v3 / App Check for the web app in Firebase Console
- [ ] Set `VITE_APPCHECK_SITE_KEY` in `.env.production` and/or GitHub secrets
- [ ] Console: leave providers in **Monitor** (not **Enforce**) until metrics look healthy
- [ ] Do **not** enable callable `enforceAppCheck` until Monitor is clean (separate change + batched functions deploy)

Missing `VITE_APPCHECK_SITE_KEY` does **not** block the app (unlike login reCAPTCHA).

---

## Catalog (admin UI only — do not wipe production)

Live catalog is Firestore `vendors` / `locations`, edited via owner **Property Config** / **Menu Config** / **Create Space**.

**Danger:** Do **not** clear `meta/catalog.seeded` or re-run `seedCatalog` on production. That can merge-overwrite matching demo IDs (`sf-main`, `v-novaspace`, etc.).

[`constants.ts`](constants.ts) and [`functions/src/seed-data.json`](functions/src/seed-data.json) are **dev fixtures only** (picsum / SF / NY / London). The client no longer uses them as a live UI fallback.

**Human content checklist**

- [ ] Fill [`CATALOG_ASSETS.md`](CATALOG_ASSETS.md) with real names, prices, and photo files
- [ ] Audit Console `vendors` / `locations` for leftover demo IDs; edit or remove after real venues exist
- [ ] Vendor brand (name, logo, description) via Brand Settings
- [ ] Branches (address, hero image, staff codes) via Branch Settings
- [ ] Floors / rooms / pricing via Space Architecture
- [ ] Menus via Menu Config (upload real photos to Storage)
- [ ] Soft launch without card payments: staff `topUpCredits` or zero-price rooms

Full manual smoke: see [`PRODUCTION_SMOKE.md`](PRODUCTION_SMOKE.md).

---

## Account deletion

- Customers: Profile → **Delete my account** → `deleteMyAccount` (wipes Firestore, deletes Auth)
- Auth Console delete: `onAuthUserDeleted` wipe safety net
- Staff / `code-*` sessions cannot self-delete

## Analytics

- Analytics and monitoring run by default (essential cookies always required for sign-in/security).
- Prior opt-outs stored in `novaspace_analytics_consent` are still honored (`rejected` stays off).
- Privacy preference UI and cookie banner are disabled.

## Later (non-blocking)

- **Customer push:** v1 registers FCM for staff/owner only; customer opt-in can reuse `registerFcmToken` / `disableFcmNotifications` later
- **AI Studio ↔ GitHub:** push Studio UI to branch `ai-studio-ui`, open PR into `main`; never push Studio straight to `main`. Protect `functions/`, `firestore.rules`, and Auth/verification paths in review
- **Payments:** Profile “cards” are cosmetic; bookings use credits — real processors are a separate project

## Useful scripts

| Script | What it does |
|---|---|
| `npm run deploy:production` | Build + rules + hosting + functions |
| `npm run deploy:rules` | Firestore + Storage rules only |
| `npm run functions:deploy` | Functions only |
| `npm run deploy:hosting` | Frontend only |
| `npm run lint` | Typecheck |

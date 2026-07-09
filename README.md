# Nova Space

Production app for booking coworking desks and rooms (`novaspace.work`).

## Local development

```bash
npm install
npm --prefix functions install
cp .env.production.example .env.local   # optional local keys
npm run dev
```

Phone SMS does **not** work on `localhost`. Use `https://novaspace.work` or `http://127.0.0.1`.

## Production deploy

```bash
# Preferred: hosting + Firestore/Storage rules + Cloud Functions
npm run deploy:production
```

Order matters for phone verification: **rules + functions must ship together** (`phoneVerified` is server-only).

Manual / one-time (not every deploy):

1. Secrets → `npm run setup:secrets` then `npm run functions:deploy` if secrets changed
2. Remote Config → `npm run deploy:remote-config`
3. Email extension SMTP → `node scripts/set-titan-smtp-secret.mjs` (or equivalent)
4. Custom domain / Auth authorized domains → `npm run connect:domain` / Firebase Console

CI (`.github/workflows/deploy.yml`) needs `FIREBASE_TOKEN` or `FIREBASE_SERVICE_ACCOUNT`, plus build secrets:

| GitHub secret | Purpose |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | Required for production login (fail-closed if missing) |
| `VITE_APPCHECK_SITE_KEY` | Optional App Check |
| `VITE_FIREBASE_VAPID_KEY` | Optional staff Web Push (shift reminders) |

Copy `.env.production.example` → `.env.production` for local production builds (gitignored).

## Secrets checklist (Cloud Functions)

| Secret | Notes |
|---|---|
| `GEMINI_API_KEY` | Nova bot / AI |
| `RECAPTCHA_SECRET_KEY` | Server verify for login |
| `OWNER_PASSCODE` | Owner staff login |
| SMTP (extension) | Support + transactional email |

```bash
npm run setup:secrets -- GEMINI_API_KEY "<key>"
npm run setup:secrets -- RECAPTCHA_SECRET_KEY "<secret>"
npm run setup:secrets -- OWNER_PASSCODE "<passcode>"
```

## Phone SMS checklist

- [ ] Auth authorized domains include `novaspace.work` and `www.novaspace.work`
- [ ] Phone provider enabled; Egypt (+20) allowed if needed
- [ ] Test on production or `127.0.0.1` (never bare `localhost`)
- [ ] After deploy: Send SMS → code → profile shows Verified; client forge of `phoneVerified` is denied
- [ ] `confirmPhoneVerified` Cloud Function is live (rules lock client writes)

## Support email checklist

- [ ] Extension `firestore-send-email` deployed
- [ ] SMTP secret configured
- [ ] Smoke: Support form → `mail` collection → inbox

## Account deletion

- Customers: Profile → **Delete my account** → `deleteMyAccount` callable (wipes Firestore, deletes Auth)
- Auth Console delete: `onAuthUserDeleted` wipe safety net
- Staff / `code-*` sessions cannot self-delete

## Demo catalog warning

`constants.ts` and `functions/src/seed-data.json` may still contain placeholder images (e.g. picsum) and “Beta Lab” copy. **Re-seed production with real venue assets before launch** — do not ship demo catalog as-is.

## reCAPTCHA

Production builds **fail closed** if `VITE_RECAPTCHA_SITE_KEY` is missing (sign-in blocked). App Check remains optional.

## Useful scripts

| Script | What it does |
|---|---|
| `npm run deploy:production` | Build + rules + hosting + functions |
| `npm run deploy:rules` | Firestore + Storage rules only |
| `npm run functions:deploy` | Functions only |
| `npm run deploy:hosting` | Frontend only |
| `npm run lint` | Typecheck |

# WhatsApp phone OTP setup

Nova Space sends phone verification codes via **Meta WhatsApp Cloud API** (not Firebase SMS).

## 1. Meta Business

1. Create/open a [Meta Developer](https://developers.facebook.com/) app and add the **WhatsApp** product.
2. In **WhatsApp → API Setup**, copy:
   - **Phone number ID**
   - A permanent **System User** access token (not the 24h temporary token)
3. Create a message template with category **Authentication** (OTP).
   - Suggested name: `novaspace_phone_otp`
   - Language: `en_US` (or set `WHATSAPP_TEMPLATE_LANG`)
   - Body must include a single `{{1}}` placeholder for the 6-digit code
   - Wait until status is **Approved**

## 2. Firebase secrets

```bash
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
```

Optional (defaults shown):

```bash
firebase functions:config:set  # or params in functions/.env
# WHATSAPP_TEMPLATE_NAME=novaspace_phone_otp
# WHATSAPP_TEMPLATE_LANG=en_US
```

With Firebase Functions params, put overrides in `functions/.env`:

```
WHATSAPP_TEMPLATE_NAME=novaspace_phone_otp
WHATSAPP_TEMPLATE_LANG=en_US
```

Then redeploy:

```bash
npm --prefix functions run build
firebase deploy --only functions:sendWhatsAppVerificationCode,functions:verifyWhatsAppCode,firestore
```

Or full: `npm run deploy:production`

## 3. Test

1. Sign in as a customer on https://novaspace.work
2. Profile → verify phone → **Send WhatsApp code**
3. Open WhatsApp on that number, enter the 6-digit code
4. Profile should show Verified; hard refresh should stay Verified

## Notes

- Recipient must have WhatsApp on that number.
- Authentication messages are **billed by Meta** per country.
- Password reset via phone still uses Firebase SMS if that flow is used; profile verification uses WhatsApp only.
- If Meta’s auth template does not use a URL button, the Graph API may reject the `button` component — adjust `sendWhatsAppTemplateOtp` in `functions/src/whatsappVerification.ts` to match your approved template shape.

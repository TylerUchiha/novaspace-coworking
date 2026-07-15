# WhatsApp phone OTP (unused)

Nova Space currently uses **Firebase Phone SMS** for profile phone verification.

The WhatsApp Cloud Function (`sendWhatsAppVerificationCode`) and related secrets may still exist in the project from an earlier experiment, but the client UI does **not** call them.

To re-enable WhatsApp later, see git history around commit `9e0ab5a` and restore the WhatsApp `PhoneVerificationForm` path.

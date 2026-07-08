/**
 * Optional: set a project-specific Web Push VAPID public key in firebase-applet-config.json
 * or VITE_FIREBASE_VAPID_KEY. The app works without this using Firebase's default key.
 *
 * To use a custom key pair:
 * 1. Open Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
 * 2. Generate or import a key pair
 * 3. Copy the public key into firebase-applet-config.json as "vapidKey"
 * 4. Rebuild and deploy hosting
 *
 * Console:
 * https://console.firebase.google.com/project/refined-legend-420223/settings/cloudmessaging/web
 */

console.log(`NovaSpace FCM setup

Push notifications use Firebase's built-in default Web Push key unless you set:
  - firebase-applet-config.json → "vapidKey"
  - or VITE_FIREBASE_VAPID_KEY in .env.local (dev builds)

Optional custom key console:
https://console.firebase.google.com/project/refined-legend-420223/settings/cloudmessaging/web
`);

#!/usr/bin/env node
/**
 * Prints the Google Cloud Console link to add the custom-domain OAuth redirect URI.
 * Required once for Google sign-in on novaspace.work.
 */
const PROJECT_ID = 'refined-legend-420223';
const CLIENT_ID = '1098807214267-56ljdjbcctmpo7osu79n21i4lh7t4b7q.apps.googleusercontent.com';
const REDIRECTS = [
  'https://novaspace.work/__/auth/handler',
  'https://www.novaspace.work/__/auth/handler',
];

console.log('Add these Authorized redirect URIs to your Firebase Google OAuth web client:\n');
for (const uri of REDIRECTS) console.log(`  ${uri}`);
console.log(
  `\nConsole: https://console.cloud.google.com/apis/credentials/oauthclient/${CLIENT_ID}?project=${PROJECT_ID}`,
);
console.log(
  `\nOAuth consent app name: https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT_ID}`,
);

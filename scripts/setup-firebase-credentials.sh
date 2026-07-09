#!/usr/bin/env bash
# Configures Firebase CLI auth from cloud environment secrets.
#
# Add ONE of these in Cursor → Dashboard → Cloud Agents → Secrets:
#   FIREBASE_TOKEN              Runtime Secret — output of `firebase login:ci`
#   GOOGLE_APPLICATION_CREDENTIALS_JSON  Runtime Secret — full service account JSON
#
set -euo pipefail

PROJECT_ID="refined-legend-420223"
FIREBASE_CLI=(npx firebase-tools@14)

setup_service_account() {
  if [ -z "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}" ]; then
    return 1
  fi

  export GOOGLE_APPLICATION_CREDENTIALS="/tmp/novaspace-firebase-sa.json"
  printf '%s' "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > "$GOOGLE_APPLICATION_CREDENTIALS"
  chmod 600 "$GOOGLE_APPLICATION_CREDENTIALS"
  echo "Configured GOOGLE_APPLICATION_CREDENTIALS from secret."
  return 0
}

verify_firebase_auth() {
  local -a args=(--project "$PROJECT_ID" --non-interactive)
  if [ -n "${FIREBASE_TOKEN:-}" ]; then
    args+=(--token "$FIREBASE_TOKEN")
  fi

  if "${FIREBASE_CLI[@]}" projects:list "${args[@]}" >/dev/null 2>&1; then
    echo "Firebase authentication verified for project $PROJECT_ID."
    return 0
  fi

  return 1
}

if [ -n "${FIREBASE_TOKEN:-}" ]; then
  echo "FIREBASE_TOKEN detected."
  if verify_firebase_auth; then
    exit 0
  fi
  echo "FIREBASE_TOKEN is set but Firebase authentication failed. Regenerate with: firebase login:ci"
  exit 1
fi

if setup_service_account; then
  if verify_firebase_auth; then
    exit 0
  fi
  echo "Service account JSON is set but Firebase authentication failed."
  exit 1
fi

# Fall through to interactive/local Firebase CLI login (developer machines).
if verify_firebase_auth; then
  echo "Using existing Firebase CLI credentials for project $PROJECT_ID."
  exit 0
fi

echo "No Firebase credentials in this environment."
echo "Add FIREBASE_TOKEN (recommended) to Cursor Cloud Agents → Secrets, then restart the agent."
echo "Or run locally: firebase login"
echo "Generate a CI token with: firebase login:ci"
exit 1

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID="refined-legend-420223"
FIREBASE_CLI=(npx firebase-tools@14)
FB_ARGS=(--project "$PROJECT_ID" --non-interactive)

if [ -n "${FIREBASE_TOKEN:-}" ]; then
  FB_ARGS+=(--token "$FIREBASE_TOKEN")
fi

if [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="/tmp/novaspace-firebase-sa.json"
  printf '%s' "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > "$GOOGLE_APPLICATION_CREDENTIALS"
  chmod 600 "$GOOGLE_APPLICATION_CREDENTIALS"
fi

echo "==> Verifying Firebase credentials..."
bash scripts/setup-firebase-credentials.sh

echo "==> Building frontend..."
npm run build

echo "==> Deploying Firestore + Storage rules..."
"${FIREBASE_CLI[@]}" deploy "${FB_ARGS[@]}" \
  --only firestore:ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77,storage

echo "==> Deploying hosting to novaspace.work..."
"${FIREBASE_CLI[@]}" deploy "${FB_ARGS[@]}" --only hosting

echo "==> Deploy complete."

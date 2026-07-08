#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building frontend..."
npm run build

echo "==> Deploying Firestore + Storage rules..."
npm run deploy:rules

echo "==> Deploying hosting to novaspace.work..."
npx firebase-tools@14 deploy --project refined-legend-420223 --only hosting --non-interactive

echo "==> Deploy complete."

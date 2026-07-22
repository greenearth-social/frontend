#!/usr/bin/env bash

set -euo pipefail

readonly PROJECT_ID="${PROJECT_ID:-greenearth-471522}"
readonly ENVIRONMENT="${1:-}"

case "$ENVIRONMENT" in
  stage)
    readonly DATABASE="greenearth-stage"
    readonly FIREBASE_CONFIG="firebase.stage.json"
    ;;
  prod)
    readonly DATABASE="greenearth-prod"
    readonly FIREBASE_CONFIG="firebase.json"
    ;;
  *)
    echo "Usage: $0 <stage|prod>" >&2
    exit 2
    ;;
esac

for command in firebase gcloud; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$FIREBASE_CONFIG" || ! -f firestore.rules || ! -f firestore.indexes.json ]]; then
  echo "Run this script from the frontend repository root." >&2
  exit 1
fi

echo "Deploying Firestore rules and indexes to $DATABASE..."
firebase --config "$FIREBASE_CONFIG" deploy \
  --only "firestore:$DATABASE" \
  --project "$PROJECT_ID" \
  --non-interactive

readonly TTL_COLLECTIONS=(
  feed_cache
  seen_posts
  discarded_posts
  feed_debug
  feed_snapshots
)

for collection in "${TTL_COLLECTIONS[@]}"; do
  echo "Ensuring TTL policy on $collection.expires_at in $DATABASE..."
  gcloud firestore fields ttls update expires_at \
    --collection-group="$collection" \
    --database="$DATABASE" \
    --project="$PROJECT_ID" \
    --enable-ttl \
    --async \
    --quiet >/dev/null
done

echo "Firestore configuration deployed to $DATABASE."

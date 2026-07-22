# CI/CD Documentation

## Architecture

One SPA bundle, two environments. Pull requests can deploy the bundle to a stage preview channel. A successful CI run on `main` starts the approval-gated production deployment. Only the Firestore database name changes via a static `config.json` served alongside the bundle.

```
Git push to main
    │
    ▼
┌─────────────────────────────────────────────────┐
│ CI job                                          │
│  lint → typecheck → unit tests → build frontend │
│  → build Cloud Functions → upload artifacts     │
└────────────┬────────────────────────────────────┘
             │ (same artifact)
             ▼
┌───────────────────────────────────────────────────┐
│ Deploy stage                                      │
│  dist/config.json → { firestoreDatabase: "..." }  │
│  functions/.env    → APP_ORIGIN, KID, JWKS        │
│  → Firebase preview channel                       │
└────────────┬──────────────────────────────────────┘
             │ (manual approval via GitHub Environments)
             ▼
┌───────────────────────────────────────────────────┐
│ Deploy prod                                       │
│  dist/config.json → { firestoreDatabase: "..." }  │
│  functions/.env    → APP_ORIGIN, KID, JWKS        │
│  → Firebase live channel                          │
└───────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `public/config.json` | Default (dev) runtime config. Swapped per environment during deploy |
| `functions/.env` | Function env vars. Generated during deploy from GitHub Variables |
| `firebase.json` / `firebase.stage.json` | Hosting rewrites, named Firestore databases, emulator ports, function source directory |
| `firestore.rules` | Path-based read-only security rules |
| `firestore.indexes.json` | Canonical composite indexes for both named databases |
| `scripts/deploy-firestore.sh` | Deploys rules, indexes, and TTL policies for one environment |

## Configuration reference

### What lives where

| Value | Location | How it gets to production |
|-------|----------|---------------------------|
| `BLUESKY_OAUTH_CLIENT_PRIVATE_KEY` | Google Cloud Secret Manager | Set ONCE via CLI. Bound to functions via `{ secrets: [...] }` in code |
| `OAUTH_STATE_ENCRYPTION_KEY` | Google Cloud Secret Manager | 64-character hexadecimal AES-256 key. Bound to OAuth functions in code |
| `BLUESKY_OAUTH_PUBLIC_JWKS` | GitHub Variable | CI writes to `functions/.env` before deploy. Deployed with functions |
| `APP_ORIGIN` | GitHub Variable | CI writes to `functions/.env` before deploy |
| `BLUESKY_OAUTH_CLIENT_KID` | GitHub Variable | CI writes to `functions/.env` before deploy |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Secret | Used by the `firebase` CLI in CI to authenticate deploys |
| `VITE_FIREBASE_API_KEY` | `.env.local` (local) / build-time | Baked into the JS bundle at build time |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env.local` (local) / build-time | Baked into the JS bundle at build time |
| `VITE_FIREBASE_PROJECT_ID` | `.env.local` (local) / build-time | Baked into the JS bundle at build time |
| `VITE_FIREBASE_APP_ID` | `.env.local` (local) / build-time | Baked into the JS bundle at build time |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env.local` (local) / build-time | Baked into the JS bundle at build time |
| Firestore database name | `dist/config.json` | Swapped by CI before deploy (`greenearth-stage` / `greenearth-prod`) |

### Why the private key goes to Secret Manager

Firebase Functions v2 requires secrets declared in code (`{ secrets: ["NAME"] }`) to live in Google Cloud Secret Manager. This is a security requirement — the runtime injects the value only into functions that explicitly declare it. Regular `.env` variables cannot satisfy this:

```typescript
// auth-bluesky.ts — the { secrets: [...] } option binds the secret
export const authBluesky = onRequest(
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY", "OAUTH_STATE_ENCRYPTION_KEY"] },
  async (req, res) => { /* ... */ }
);
```

Everything else (`APP_ORIGIN`, `BLUESKY_OAUTH_CLIENT_KID`, `BLUESKY_OAUTH_PUBLIC_JWKS`) is non-sensitive and flows through GitHub Variables → `functions/.env` → deployed.

## One-time setup

Run these ONCE before the CI pipeline runs for the first time.

### 1. Generate OAuth key pair

```sh
node scripts/generate-oauth-keys.cjs
```

Creates:
- `functions/keys/private-key.json` — ES256 private key JWK (for dev/testing only)
- `functions/keys/public-jwks.json` — Public JWKS (for dev/testing only)

Both files are gitignored. For production, a different key pair is stored in Secret Manager.

### 2. Store the private key in Secret Manager

```sh
firebase functions:secrets:set BLUESKY_OAUTH_CLIENT_PRIVATE_KEY
# Paste the contents of functions/keys/private-key.json when prompted
```

Store a separate encryption key for OAuth state:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
firebase functions:secrets:set OAUTH_STATE_ENCRYPTION_KEY
# Paste the generated 64-character hexadecimal value when prompted
```

If both secrets already exist and the deployed public JWKS matches the configured private key, do not regenerate them for a routine deployment. Treat changing the private key and public JWKS as one coordinated rotation.

### 3. Add GitHub Secrets and Variables

All values go at **repo scope** (Settings → Secrets and variables → Actions). No environment-scoped variables needed — stage and prod share the same Firebase project, Cloud Functions, and OAuth metadata.

**Secrets** (encrypted, masked in logs):

| Name | Value |
|------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Full service account JSON. Get from Firebase Console → Project settings → Service accounts → Generate new private key. This key works for the entire `greenearth-471522` project — one key covers both stage and prod deploys. |

**Variables** (not encrypted, visible in the UI):

| Name | Value |
|------|-------|
| `APP_ORIGIN` | `https://greenearth-471522.web.app` (your Firebase Hosting URL, no trailing slash) |
| `BLUESKY_OAUTH_CLIENT_KID` | `key-1` |
| `BLUESKY_OAUTH_PUBLIC_JWKS` | Contents of `functions/keys/public-jwks.json` (the JSON object including the `{"keys":[...]}` wrapper) |
| `VITE_USE_MOCK_SERVICES` | `false` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `greenearth-471522.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `greenearth-471522` |

The workflow explicitly sets `VITE_USE_FIREBASE_EMULATORS=false` for production builds.

#### Deployment service-account IAM

The service account identified by the `client_email` field in
`FIREBASE_SERVICE_ACCOUNT` needs deployment permissions in addition to its
Firebase Admin SDK runtime roles. Ask a project IAM administrator to grant:

- Project-level `roles/serviceusage.serviceUsageViewer` so the Firebase CLI can
  verify required APIs.
- Project-level `roles/serviceusage.apiKeysViewer` for Firebase Hosting CLI
  deployment.
- Project-level `roles/firebasehosting.admin` for live and preview Hosting
  releases.
- Project-level `roles/cloudfunctions.admin` for Cloud Functions v2 deployment.
- Project-level `roles/firebaserules.admin` for Firestore Rules deployment.
- Project-level `roles/datastore.indexAdmin` for Firestore composite-index and
  TTL-policy deployment.
- `roles/iam.serviceAccountUser` on the Functions runtime service account
  `21637448064-compute@developer.gserviceaccount.com`.
- `roles/iam.serviceAccountUser` on the Cloud Build service account
  `21637448064@cloudbuild.gserviceaccount.com`.

Do not grant project Owner or Editor solely to make CI deployment work. The
workflow prints the authenticated deployment identity and verifies required API
visibility before invoking Firebase, so a missing IAM grant fails early.

For the existing Green Earth project, run `./scripts/gcp_setup.sh` once from the
API repository after this deployment change is checked out and before triggering
the frontend deployment. The setup remains the owner of service-account/IAM
provisioning and grants `roles/datastore.indexAdmin` project-wide.

### 4. Protect production deploys with an environment

GitHub repo → **Settings → Environments** → **New environment**

- Name: `production`
- Enable **Required reviewers** (up to 6 people must approve before prod deploy)
- Optionally set **Wait timer** to delay deploys
- **No environment-scoped variables or secrets needed** — this environment exists only as an approval gate. All config is repo-scoped.

### 5. Push to main

```sh
git add . && git commit -m "CI/CD setup" && git push
```

The `ci` job runs first. Pull requests can deploy the stage preview after approval of the `stage` environment. On push to `main`, the separate Deploy workflow starts after CI succeeds and waits for approval of the `production` environment.

## Pipeline stages

### CI (every push, every PR)

```yaml
ci:
  runs-on: ubuntu-latest
  steps:
    - checkout
    - npm ci
    - npm run lint
    - npm run typecheck
    - npm run test:unit
    - npm run build          # Vite → dist/
    - cd functions
      npm ci
      npm run build          # tsc → lib/
    - upload dist/ + functions/ artifacts
```

### Deploy stage (pull requests only)

```yaml
deploy-stage:
  needs: ci
  runs-on: ubuntu-latest
  steps:
    - download artifacts from ci
    - write dist/config.json → greenearth-stage
    - deploy Firestore rules, indexes, and TTL policies to greenearth-stage
    - deploy Hosting → preview channel "stage"
    - deploy stage OAuth Functions
```

Preview channels get a unique URL like `https://greenearth-471522--stage-abc123.web.app`. Good for pre-prod testing.

### Deploy prod (push to main, manual approval)

```yaml
deploy-prod:
  needs: deploy-stage
  runs-on: ubuntu-latest
  environment: production         # ← triggers approval workflow
  steps:
    - checkout the exact successful CI commit
    - download artifacts from ci
    - write dist/config.json → greenearth-prod
    - write functions/.env → APP_ORIGIN, KID, JWKS from GitHub Variables
    - validate production configuration
    - deploy Firestore rules, indexes, and TTL policies to greenearth-prod
    - deploy functions
    - deploy the Firebase Hosting live channel
```

The same rules and indexes are configured independently for both named databases.
Stage deployments target only `greenearth-stage`; production deployments target
only `greenearth-prod`. The shared deployment helper also idempotently enables
`expires_at` TTL on `feed_cache`, `seen_posts`, `discarded_posts`, `feed_debug`,
and `feed_snapshots`. Firebase checks function source and configuration hashes
and skips unchanged functions rather than creating unnecessary revisions.

This repository is the sole source of truth for Firebase rules, indexes, TTL
policies, emulators, Functions, and Hosting. API deployments do not mutate this
configuration.

## Rotating the OAuth key pair

If the private key is compromised or needs rotation:

```sh
# 1. Generate a new pair
node scripts/generate-oauth-keys.cjs

# 2. Update the secret in Secret Manager
firebase functions:secrets:set BLUESKY_OAUTH_CLIENT_PRIVATE_KEY
# Paste the NEW private key

# 3. Update GitHub Variables
#    Settings → Secrets and variables → Actions → Variables
#    BLUESKY_OAUTH_PUBLIC_JWKS → paste new public-jwks.json

# 4. Re-deploy functions to pick up the new key
#    (push to main or run firebase deploy --only functions)
```

BlueSky will see the new public key at `/.well-known/jwks.json`. The old key pair should be removed from GitHub and any local `.env` files.

## Manual deploy (without CI)

If CI is unavailable or you need an emergency deploy from your machine:

```sh
# Build
npm run build
cd functions && npm run build && cd ..

# Example: prepare a stage Hosting build
printf '{"firestoreDatabase":"greenearth-stage"}\n' > dist/config.json

# Set function vars (needed only if not already set)
export APP_ORIGIN=https://greenearth-471522.web.app
export BLUESKY_OAUTH_CLIENT_KID=key-1
# BLUESKY_OAUTH_CLIENT_PRIVATE_KEY must exist in Secret Manager (already set)
# If BLUESKY_OAUTH_PUBLIC_JWKS was set via firebase functions:secrets:set, it's persisted

# Deploy stage Firestore configuration and a Hosting preview separately
./scripts/deploy-firestore.sh stage
firebase hosting:channel:deploy stage

# Production uses ./scripts/deploy-firestore.sh prod and the live Hosting channel. Do
# not run those commands without an explicit production approval.
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| CI deploy fails with auth error | `FIREBASE_SERVICE_ACCOUNT` secret missing or expired | Regenerate service account key in Firebase Console, update GitHub Secret |
| Functions return "APP_ORIGIN not configured" | GitHub Variable `APP_ORIGIN` missing | Add the variable in repo Settings |
| Functions return "JWKS not configured" | `BLUESKY_OAUTH_PUBLIC_JWKS` variable missing or malformed | Check that the full `{"keys":[...]}` JSON is set |
| OAuth fails: "client_id could not be fetched" | `APP_ORIGIN` doesn't match deployed URL | Verify the variable matches `https://<project>.web.app` |
| OAuth fails: "Invalid client assertion" | Private key out of sync | Re-run `firebase functions:secrets:set BLUESKY_OAUTH_CLIENT_PRIVATE_KEY` |
| Stage deploys but prod doesn't | `production` environment not approved | Go to Actions → pending deploy → Review deployments → Approve |
| Bundle rebuilds on every deploy | CI artifacts expired (>1 day) | CI auto-rebuilds; artifacts keep for 1 day |

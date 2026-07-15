# CI/CD Documentation

## Architecture

One SPA bundle, two environments. The same compiled JavaScript is deployed to both stage and prod. Only the Firestore database name changes via a static `config.json` served alongside the bundle.

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
| `firebase.json` | Hosting rewrites, emulator ports, function source directory |
| `firestore.rules` | Path-based read-only security rules |

## Configuration reference

### What lives where

| Value | Location | How it gets to production |
|-------|----------|---------------------------|
| `BLUESKY_OAUTH_CLIENT_PRIVATE_KEY` | Google Cloud Secret Manager | Set ONCE via CLI. Bound to functions via `{ secrets: [...] }` in code |
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
  { secrets: ["BLUESKY_OAUTH_CLIENT_PRIVATE_KEY"] },
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

The `ci` job runs first. On push to `main`, `deploy-stage` runs automatically. `deploy-prod` waits for manual approval in the GitHub Actions UI.

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

### Deploy stage (push to main only)

```yaml
deploy-stage:
  needs: ci
  runs-on: ubuntu-latest
  steps:
    - download artifacts from ci
    - write dist/config.json → greenearth-stage
    - write functions/.env → APP_ORIGIN, KID, JWKS from GitHub Variables
    - firebase deploy → preview channel "stage"
    - firebase deploy → firestore rules + functions (if changed)
```

Preview channels get a unique URL like `https://greenearth-471522--stage-abc123.web.app`. Good for pre-prod testing.

### Deploy prod (push to main, manual approval)

```yaml
deploy-prod:
  needs: deploy-stage
  runs-on: ubuntu-latest
  environment: production         # ← triggers approval workflow
  steps:
    - download artifacts from ci
    - write dist/config.json → greenearth-prod
    - write functions/.env → APP_ORIGIN, KID, JWKS from GitHub Variables
    - firebase deploy → live channel
```

Only the `dist/config.json` database name differs from stage. The bundle, functions, and rules are identical.

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

# Set the right database
printf '{"firestoreDatabase":"greenearth-stage"}\n' > dist/config.json

# Set function vars (needed only if not already set)
export APP_ORIGIN=https://greenearth-471522.web.app
export BLUESKY_OAUTH_CLIENT_KID=key-1
# BLUESKY_OAUTH_CLIENT_PRIVATE_KEY must exist in Secret Manager (already set)
# If BLUESKY_OAUTH_PUBLIC_JWKS was set via firebase functions:secrets:set, it's persisted

# Deploy
firebase deploy --only hosting,functions,firestore:rules
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

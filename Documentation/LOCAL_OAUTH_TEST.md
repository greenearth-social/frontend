# Local OAuth End-to-End Test

> **Startup order**: emulators → Vite → tunnel. Restart Vite whenever you change `.env.local`.

This guide walks through testing the Bluesky OAuth flow locally using Firebase emulators and an HTTPS tunnel. No production Firestore data is read or written during this test.

## How it works

During local testing, three services run together:

```
Tunnel (HTTPS) → Vite dev server :3000
                    ├── /auth/bluesky        → proxy → Functions emulator :5001
                    ├── /oauth/callback       → proxy → Functions emulator :5001
                    ├── /.well-known/*        → proxy → Functions emulator :5001
                    └── everything else       → SPA (mock mode)
```

The `vite.config.ts` proxy rules forward the OAuth and metadata paths to the Functions emulator. Everything else is served as the SPA.

## What you need

- A Bluesky account
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Tailscale Funnel or ngrok for a public HTTPS URL
- Firebase web app config (apiKey, authDomain, appId, messagingSenderId)
- Firebase Admin service account key (for Cloud Functions custom-token minting)

## 1. Generate the OAuth key pair

The Cloud Functions need an ES256 key pair to act as a confidential OAuth client.

```sh
cd /Users/gauthamraju/Projects/GreenEarth/frontend
node scripts/generate-oauth-keys.cjs
```

This creates `functions/keys/private-key.json` and `functions/keys/public-jwks.json`.

Add the key ID to `functions/.env`:

```sh
BLUESKY_OAUTH_CLIENT_KID=key-1
```

## 2. Configure environment files

### Frontend: `.env.local`

Copy `.env.example` to `.env.local` and fill in the values:

```sh
cp .env.example .env.local
```

```sh
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=greenearth-471522
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIRESTORE_DATABASE=greenearth-stage

VITE_USE_MOCK_SERVICES=true
VITE_USE_FIREBASE_EMULATORS=true

# Add your tunnel domain (see step 3)
VITE_ALLOWED_HOSTS=localhost,my-app.ngrok-free.app
```

**Important**: `VITE_ALLOWED_HOSTS` must include your tunnel hostname (e.g. `my-app.ngrok-free.app` or your Tailscale domain). Vite rejects requests from unknown hosts by default. **Restart Vite** after changing this value.

### Cloud Functions: `functions/.env`

Copy `functions/.env.example` to `functions/.env` and fill in the values:

```sh
cp functions/.env.example functions/.env
```

```sh
FIREBASE_PROJECT_ID=greenearth-471522
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
APP_ORIGIN=https://your-app.tunnel.ts.net
BLUESKY_OAUTH_CLIENT_KID=key-1
```

Keys are read from `functions/keys/private-key.json` and `functions/keys/public-jwks.json` (created by the key generation script).

`GOOGLE_APPLICATION_CREDENTIALS` should point to the service account JSON downloaded from Firebase console → Project settings → Service accounts → Generate new private key.

## 3. Start the HTTPS tunnel

First, update `.env.local` with your tunnel hostname in `VITE_ALLOWED_HOSTS`.

Then start the tunnel pointing at port 3000:

### Option A: Tailscale Funnel

```sh
tailscale funnel --bg 3000
```

Your `APP_ORIGIN` will be something like `https://your-machine.your-tailnet.ts.net`.

### Option B: ngrok

```sh
ngrok http 3000
```

Use the generated `https://*.ngrok-free.app` URL as `APP_ORIGIN`.

## 4. Start Firebase emulators

Run this **before** starting the Vite dev server:

This starts:
- Auth emulator at `http://127.0.0.1:9099`
- Firestore emulator at `127.0.0.1:8080`
- Functions emulator at `127.0.0.1:5001`

## 5. Start the Vite dev server

In a new terminal:

```sh
npm run dev
```

Vite runs on port `3000`.

## 6. Verify metadata endpoints

Visit these URLs (through your tunnel) before triggering OAuth:

```text
https://<your-tunnel>/.well-known/oauth-client-metadata
https://<your-tunnel>/.well-known/jwks.json
```

Both should return valid JSON with HTTP 200 and `Content-Type: application/json`.

## 7. Trigger the OAuth flow

Visit:

```text
https://<your-tunnel>/auth/bluesky?return_url=/feed
```

You should be redirected to Bluesky, see a consent screen, and then be redirected back to:

```text
https://<your-tunnel>/#/auth/finish?token=...&return_url=/feed
```

The frontend will call `signInWithCustomToken(token)` and redirect to `#/feed`.

## 8. Verify no prod data was touched

- All Firestore writes during this test go to the emulator only (`pendingOAuthRequests/{state}`).
- All custom tokens are minted against the Auth emulator.
- No requests are sent to `greenearth-stage` or `greenearth-prod` while `VITE_USE_FIREBASE_EMULATORS=true` and the Functions env points to emulators.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Tunnel URL shows feed landing page instead of JSON/metadata | Functions emulator not running or Vite process started before emulators | Start emulators first, then restart Vite |
| Vite rejects tunnel requests (403/blocked) | `VITE_ALLOWED_HOSTS` missing tunnel domain | Add tunnel hostname to `VITE_ALLOWED_HOSTS` in `.env.local` and restart Vite |
| Bluesky shows "client_id could not be fetched" | Metadata URL is not publicly reachable or returns wrong content type | Check tunnel is up and `APP_ORIGIN` matches the tunnel URL exactly |
| `/.well-known/oauth-client-metadata` 404 | `firebase.json` rewrite not active or Functions emulator not running | Restart `firebase emulators:start --only auth,firestore,functions` |
| `/.well-known/oauth-client-metadata` returns "APP_ORIGIN not configured" | Missing env in functions | Verify `functions/.env` has `APP_ORIGIN` set |
| `jwks_uri` fetch fails | JWKS endpoint returns error or wrong content type | Verify `BLUESKY_OAUTH_PUBLIC_JWKS` is set and valid JSON |
| Callback says "Invalid or expired state" | Pending state TTL expired or Firestore emulator cleared | Retry within 10 minutes; check emulator has the doc |
| Custom token minting fails | Missing `GOOGLE_APPLICATION_CREDENTIALS` or wrong project | Verify service account key path and `FIREBASE_PROJECT_ID` |
| Frontend says "Not signed in" after redirect | `VITE_USE_FIREBASE_EMULATORS=false` or wrong Firebase config | Ensure `.env.local` has emulators enabled |
| `ERR_CONNECTION_REFUSED` on proxy routes | Functions emulator port mismatch | Confirm emulators are running on port 5001 |

## Deployment

See `Documentation/CI_CD.md` for the full CI/CD pipeline, one-time setup, and configuration reference.

### Security notes

- The Firebase custom token is passed in the URL hash fragment (`/#/auth/finish?token=...`). Hash fragments are never sent to the server.
- After sign-in, the token is consumed and the URL is immediately replaced with `#/feed`.
- Access tokens and DPoP keys are not persisted — they are used only during the OAuth callback.
- Firestore reads are gated by security rules (`request.auth.uid` matches the `did` in the path).

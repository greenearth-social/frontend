# GreenEarth Feed Debug — AGENTS.md

## Quick commands

```sh
npm run dev          # Vite dev server (port 3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --ext .ts
npm run test:unit    # vitest run
npm run test:e2e     # playwright test
```

CI order: `lint` → `typecheck` → `test:unit` → `test:e2e` → `build`.

## Architecture

```
src/
  services/         → interfaces (IAuthService, IFeedDebugService, IHydrationService)
    mock/           → Mock implementations (VITE_USE_MOCK_SERVICES=true, default)
    firebase/       → Real Firebase Auth + Firestore implementations
    api/            → Cloud Function Hydration service stub
  stores/           → MobX stores (AuthStore, AccountStore, FeedStore, UIStore)
    root-store.ts   → owns all stores + ServiceProvider
  models/           → Domain types; feed-debug-snapshot.ts + bluesky-account.ts
  components/       → Lit elements with Tailwind (extend MobxLitElement)
  pages/            → feed-page.ts accesses stores via getRootStore()
  test/fixtures/    → sample-feed-debug.json
functions/          → Cloud Functions OAuth bridge + metadata endpoints
```

### Key rules

- **Stores never import Firebase, atproto, or HTTP clients.** They only consume service interfaces injected via `ServiceProvider`.
- **Single DID = single Firebase user.** No multi-account. `AccountStore.activeAccount` is derived from `authStore.currentUser.uid`. The `IAccountService` interface and `account-switcher` component have been removed.
- **`getRootStore()`** (from `main.ts`) is the DI entry point. Components call it directly rather than receiving stores as Lit properties.
- **Routing** is hash-based (`#/feed`, `#/auth/finish`, `#/about`), handled in `app-shell.ts`.

## Real services mode

Set `VITE_USE_MOCK_SERVICES=false`. The real services are:

| Service | File | Behavior |
|---------|------|----------|
| `FirebaseAuthService` | `src/services/firebase/firebase-auth-service.ts` | Initializes Firebase Auth, connects to emulator when `VITE_USE_FIREBASE_EMULATORS=true`, provides `signInWithCustomToken` / `signOut` / `onAuthStateChanged` |
| `FirestoreFeedDebugService` | `src/services/firebase/firestore-feed-debug-service.ts` | Reads feed debug snapshots from `users/{docId}/feed_debug` (query by `feed_name == "your-feed"`, ordered by `generated_at` desc). Uses `userDocId()` helper to strip `did:plc:` prefix. |
| `CloudFunctionHydrationService` | `src/services/api/cloud-function-hydration-service.ts` | Stub (Not implemented yet) |

### Emulator usage

When `VITE_USE_FIREBASE_EMULATORS=true`:
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `127.0.0.1:8080`

## OAuth flow

The Cloud Functions in `functions/src/auth/` handle Bluesky OAuth:

1. **`oauthClientMetadata`** — serves `/oauth-client-metadata.json` (public client metadata)
2. **`oauthJwks`** — serves `/.well-known/jwks.json` (public JWKS from env)
3. **`authBluesky`** — `GET /auth/bluesky?return_url=...` — initiates OAuth via PAR to `https://bsky.social`
4. **`oauthCallback`** — `GET /oauth/callback?code=...&state=...&iss=...` — exchanges code, mints Firebase custom token, redirects to `/#/auth/finish?token=...`

The frontend `app-shell` handles the `#/auth/finish` route by calling `signInWithCustomToken` and redirecting to `#/feed`.

### Local OAuth testing

1. `npm run dev` (Vite on port 3000)
2. `firebase emulators:start --only auth,firestore` (emulators)
3. Expose via Tailscale Funnel / ngrok
4. Set `APP_ORIGIN` to tunnel URL, point `client_id` at it
5. Visit `{tunnel_url}/auth/bluesky`

No production Firestore is read or written during local testing; only the emulator is used.

## Firestore security rules

Located at `firestore.rules`. Path-based only — no `resource.data` inspection:

```javascript
function userDocId(did) {
  return did.startsWith('did:plc:') ? did.slice(8) : did;
}

match /users/{docId} {
  allow read: if docId == userDocId(request.auth.uid);
}

match /users/{docId}/feed_debug/{requestId} {
  allow read: if docId == userDocId(request.auth.uid);
}
```

## TypeScript configuration quirks

- `experimentalDecorators: true` — required by Lit decorators (`@customElement`, `@property`)
- `useDefineForClassFields: false` — required by MobX `makeAutoObservable` pattern
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `strict: true` is enforced

## Testing

- **Vitest** environment: `happy-dom`. Component tests must `await element.updateComplete`.
- **Playwright** uses the Vite dev server as `webServer`. All tests use mock services (no external deps).
- Test fixture at `src/test/fixtures/sample-feed-debug.json`.
- E2E test checks header for mock user email instead of account-switcher.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_USE_MOCK_SERVICES` | `true` (default) for mock, `false` for real Firebase |
| `VITE_USE_FIREBASE_EMULATORS` | `true` for local emulators |
| `VITE_FIREBASE_*` | Firebase web app config (apiKey, authDomain, projectId, appId, messagingSenderId) |
| `VITE_FIRESTORE_DATABASE` | Firestore database name (e.g. `greenearth-stage`) |
| `APP_ORIGIN` | Public HTTPS origin for OAuth metadata |
| `BLUESKY_OAUTH_CLIENT_PRIVATE_KEY` | ES256 private key JWK for OAuth client assertion |
| `BLUESKY_OAUTH_CLIENT_KID` | Key ID for the above key |
| `BLUESKY_OAUTH_PUBLIC_JWKS` | Public JWKS JSON for the OAuth client

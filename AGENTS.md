# GreenEarth Feed Debug — AGENTS.md

## Quick commands

```sh
npm run dev          # Vite dev server (port 3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --ext .ts
npm run format       # prettier --write "src/**/*.ts"
npm run test:unit    # vitest run
npm run test:e2e     # playwright test
```

CI order: `lint` → `typecheck` → `test:unit` → `test:e2e` → `build`.

## Architecture

```
src/
  services/
    types.ts              → IAuthService, IFeedApiService (listFeeds, getFeedDetail, getPreferences, putPreferences)
    service-provider.ts   → ServiceProvider { authService, feedApiService }
    mock/                 → MockAuthService, MockFeedApiService (default when VITE_USE_MOCK_SERVICES=true)
    firebase/             → FirebaseAuthService, firebase-init.ts
    api/                  → FeedApiService (proxies to /api/* via Vite dev proxy)
  stores/                 → MobX stores; never import Firebase/HTTP directly
    root-store.ts         → owns all stores + ServiceProvider
  models/                 → Domain types (feed-debug-snapshot.ts, bluesky-account.ts)
  components/             → Lit elements (MobxLitElement or LitElement)
    app-shell.ts          → Main layout + hash routing + scroll-to-top on route change
    lifecycle-slider.ts   → 5-stage slider (eggs→butterfly) with drag, snap, popup
    feed-tabs.ts          → Horizontal scrollable tabs with gradient fade edges
    feed-item-card.ts     → Single post card; reference pattern for truncation CSS
  pages/                  → feed-page, controls-page, how-it-works-page, settings-page
  styles/index.css        → CSS variables (--bluesky-*), Tailwind setup
  main.ts                 → Entry point; getRootStore() is the DI accessor
functions/                → Cloud Functions OAuth bridge + metadata endpoints
```

### Responsive breakpoints

- **< 1024px**: Left sidebar hidden, drawer menu appears, center column full width
- **1024px–1199px**: Left sidebar visible (275px), center column max 600px
- **≥ 1200px**: Right sidebar visible (350px), full three-column layout

## Shadow DOM styling — Tailwind does NOT penetrate

Lit components use Shadow DOM. Global Tailwind utilities do not apply inside shadow roots.

- All styling MUST use explicit CSS in the component's `static styles` block.
- CSS custom properties (`var(--bluesky-*)`) pass through Shadow DOM.
- Tailwind class names in templates (`flex-1`, `truncate`, `text-sm`) are **non-functional** without matching CSS rules in the component stylesheet.
- Reference pattern for text truncation: `src/components/feed-item-card.ts:57-71`.

## Key rules

- **Never modify .env files, Firebase secrets, or run deployment commands** without explicit permission.
- **Stores never import Firebase, atproto, or HTTP clients.** They consume service interfaces via `ServiceProvider`.
- **`getRootStore()`** (from `main.ts`) is the DI entry point. Components call it directly.
- **Routing** is hash-based (`#/feed`, `#/controls`, `#/how-it-works`, `#/settings`, `#/auth/finish`), handled in `app-shell.ts`. Route changes scroll `.center-column` to top.
- **CSS variables** use Bluesky dark theme naming (`--bluesky-*`), defined in `src/styles/index.css`.
- **`<img>` tags in Lit components** must have explicit `width`/`height` HTML attributes to prevent alt-text flash before Shadow DOM CSS applies. Use `alt=""` for decorative icons.
- **Arrow function event handlers** that return void must use braces: `@click=${() => { this.#method(); }}` — shorthand `() => this.#method()` triggers `@typescript-eslint/no-confusing-void-expression`.

## Services

| Service | File | Behavior |
|---------|------|----------|
| `MockAuthService` | `src/services/mock/mock-auth-service.ts` | `displayName: "Mock User"`, `email: "mock@example.com"`, `uid: "mock-user-1"` |
| `MockFeedApiService` | `src/services/mock/mock-feed-api-service.ts` | Returns hardcoded feed data; `getPreferences()` returns `{ socialRadius: 2 }` |
| `FirebaseAuthService` | `src/services/firebase/firebase-auth-service.ts` | Firebase Auth; default persistence is LOCAL (survives browser restart) |
| `FeedApiService` | `src/services/api/feed-api-service.ts` | Proxies to backend `/api/*`; `_fetch()` accepts optional `RequestInit` for PUT/POST |

### Vite dev proxy

- `/api/*` → `http://localhost:8000`
- `/auth/bluesky`, `/.well-known/*` → Firebase Functions emulator on port 5001
- `/oauth/callback` → custom middleware that proxies to Functions emulator

## TypeScript configuration quirks

- `experimentalDecorators: true` — required by Lit decorators
- `useDefineForClassFields: false` — required by MobX `makeAutoObservable`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array index access may be `undefined`
- `strict: true` is enforced

## Testing

- **Vitest** environment: `happy-dom`. Component tests must `await element.updateComplete`.
- **Playwright** uses Vite dev server as `webServer`. All tests use mock services.
- Test fixture at `src/test/fixtures/sample-feed-debug.json`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_USE_MOCK_SERVICES` | `true` (default) for mock, `false` for real Firebase |
| `VITE_USE_FIREBASE_EMULATORS` | `true` for local emulators |
| `VITE_FIREBASE_*` | Firebase web app config |
| `VITE_FIRESTORE_DATABASE` | Firestore database name |
| `VITE_API_BASE_URL` | Backend API base URL (default empty) |
| `VITE_ALLOWED_HOSTS` | Comma-separated hosts for Vite dev server |
| `APP_ORIGIN` | Public HTTPS origin for OAuth metadata |
| `BLUESKY_OAUTH_CLIENT_PRIVATE_KEY` | ES256 private key JWK |
| `BLUESKY_OAUTH_CLIENT_KID` | Key ID for the above key |
| `BLUESKY_OAUTH_PUBLIC_JWKS` | Public JWKS JSON |

## OAuth flow

Cloud Functions in `functions/src/auth/`:

1. `oauthClientMetadata` — serves `/oauth-client-metadata.json`
2. `oauthJwks` — serves `/.well-known/jwks.json`
3. `authBluesky` — `GET /auth/bluesky?return_url=...` initiates OAuth via PAR
4. `oauthCallback` — exchanges code, mints Firebase custom token, redirects to `/#/auth/finish?token=...`

Frontend `app-shell` handles `#/auth/finish` by calling `signInWithCustomToken` and redirecting to `#/feed`.

## Firestore security rules

Located at `firestore.rules`. Path-based only — no `resource.data` inspection.

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

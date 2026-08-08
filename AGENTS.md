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
npm run emulators    # Auth + Firestore + Functions emulators
npm run emulators:firestore # Firestore emulator for API development
```

CI order: `lint` → `typecheck` → `test:unit` → `test:e2e` → `build`.

### Shared full-stack environment (`devctl`)

Run these commands from the sibling `internal-tools/devenv` directory. The
frontend checkout is bind-mounted and Vite hot reload is enabled.

```sh
# First-time, resumable setup; builds, starts, downloads data/models, and seeds
./devctl bootstrap

# Local sign-in and feed snapshot generation
./devctl login
./devctl feed
./devctl feed your-feed --user did:plc:...

# Daily lifecycle
./devctl pull
./devctl up
./devctl status
./devctl down

# Frontend verification inside the shared environment
./devctl test frontend
./devctl exec frontend npm run lint
./devctl exec frontend npm run typecheck
./devctl exec frontend npm run test:unit
./devctl exec frontend npm run build

# Publish local feeds through ngrok to a separate Bluesky development account
./devctl bsky up
./devctl bsky status
./devctl bsky down

# Diagnostics
./devctl doctor
./devctl status
./devctl logs frontend
./devctl logs -t frontend
./devctl restart frontend
./devctl ports
```

`test frontend` and `exec frontend` require the frontend service to be running;
use `./devctl up` first. `restart frontend` is for configuration changes, not
normal source edits. The shared stack supplies its own environment, so do not
create `.env.local` for this workflow. `devctl pull` skips dirty, diverged, or
non-upstream repositories rather than overwriting local work. Full setup and
credential requirements for `bsky` remain in
`Documentation/LOCAL_DEV_ENVIRONMENT.md`.

## Architecture

```
src/
  services/
    types.ts              → IAuthService, IFeedApiService (listFeeds, getFeedDetail, getPreferences, patchPreferences)
    service-provider.ts   → ServiceProvider { authService, feedApiService }
    mock/                 → MockAuthService, MockFeedApiService (default when VITE_USE_MOCK_SERVICES=true)
    firebase/             → FirebaseAuthService, firebase-init.ts
    api/                  → FeedApiService (proxies to /api/* via Vite dev proxy)
  stores/                 → MobX stores; never import Firebase/HTTP directly
    preferences-store.ts  → feed-keyed values/control availability and isolated optimistic updates
    root-store.ts         → owns all stores + ServiceProvider
  models/                 → Domain types (feed-debug-snapshot.ts, bluesky-account.ts)
  components/             → Lit elements (MobxLitElement or LitElement)
    app-shell.ts          → Main layout + hash routing + scroll-to-top on route change
    lifecycle-slider.ts   → 5-stage slider (eggs→butterfly) with drag, snap, popup
    feed-tabs.ts          → Horizontal scrollable tabs with gradient fade edges
    feed-item-card.ts     → Single post card; reference pattern for truncation CSS
  pages/                  → feed-page, unified settings-page, feedback-page
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
- **Routing** is hash-based (`#/feed`, canonical `#/settings`, `#/feedback`, `#/auth/finish`), handled in `app-shell.ts`. Legacy `#/controls` and `#/how-it-works` routes history-replace to Settings. Route changes scroll `.center-column` to top.
- **CSS variables** use Bluesky dark theme naming (`--bluesky-*`), defined in `src/styles/index.css`.
- **`<img>` tags in Lit components** must have explicit `width`/`height` HTML attributes to prevent alt-text flash before Shadow DOM CSS applies. Use `alt=""` for decorative icons.
- **Arrow function event handlers** that return void must use braces: `@click=${() => { this.#method(); }}` — shorthand `() => this.#method()` triggers `@typescript-eslint/no-confusing-void-expression`.

## Services

| Service | File | Behavior |
|---------|------|----------|
| `MockAuthService` | `src/services/mock/mock-auth-service.ts` | `displayName: "Mock User"`, `email: "mock@example.com"`, `uid: "mock-user-1"` |
| `MockFeedApiService` | `src/services/mock/mock-feed-api-service.ts` | Returns hardcoded feed data and the sparse feed-keyed preference contract |
| `FirebaseAuthService` | `src/services/firebase/firebase-auth-service.ts` | Firebase Auth; default persistence is LOCAL (survives browser restart) |
| `FeedApiService` | `src/services/api/feed-api-service.ts` | Maps snake_case sparse preferences and proxies feed-specific PATCH requests to `/api/*` |

## Feed-scoped controls

Preference state is keyed by `AlgorithmId`; never reuse a global preference value
when the selected feed changes. The API feed-preference response is the canonical
source of enabled controls:

- `your-feed`: Source Weights, Time Window, Purpose
- `best-of-friends`: Time Window, Purpose
- `random`: Time Window
- Politics stays a local disabled "Coming Soon" presentation and must not be sent
  to the API.

`PreferencesStore.valuesByFeed` holds resolved UI values and
`controlsByFeed` records the sparse controls returned for each feed. Components
must read with `valuesFor(feedName)` and gate controls with
`supportsControl(feedName, control)`. Updates use
`save(feedName, control, value)`, which optimistically changes and, on failure,
rolls back only that feed/control. Request versioning is also per feed/control so
a stale response cannot overwrite a newer edit or an edit to a sibling feed.

`settings-page.ts` renders the feed-specific settings pipeline. Adding an existing
control to another feed should require backend feed configuration and a matching
pipeline section; adding a genuinely new control type also requires a frontend
renderer and typed mapping. Settings explanations, feed-detail influence displays,
analytics, and feedback payloads
must always use the selected feed's resolved values.

The preference wire contract is:

```json
{
  "feeds": {
    "your-feed": {
      "source_weights": {
        "following": 0.4,
        "authors_topics": 0.3,
        "popular": 0.3
      },
      "freshness": 5,
      "purpose": 0.5
    }
  }
}
```

Read it with `getPreferences()` and mutate it with
`patchPreferences(feedName, partialPreferences)`. The removed flat response and
global `PUT` must not be reintroduced. Mock services and fixtures must use the same
contract. Preference tests should cover feed switching, visibility, serialization,
isolated optimistic updates/rollbacks, stale requests, analytics attribution,
diagrams, and feedback context.

API and frontend preference-contract changes must be deployed and rolled back
together.

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
This repository is the sole owner of Firebase rules, indexes, TTL policies,
emulator configuration, Functions, Hosting, and their deployment.

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

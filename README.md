# GreenEarth Feed Debug — Frontend

User-facing SPA for **Post Observability** — a Bluesky feed debugger that visualizes how candidate posts are scored, ranked, and diversified.

## Tech Stack

| Layer                | Technology                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| **UI Framework**     | [Lit](https://lit.dev/) (Web Components + Shadow DOM)                   |
| **State Management** | [MobX](https://mobx.js.org/)                                            |
| **Build Tool**       | [Vite](https://vitejs.dev/) (port 3000)                                 |
| **Language**         | TypeScript (strict mode)                                                |
| **Auth**             | Firebase Auth (custom tokens via Bluesky OAuth)                         |
| **Database**         | Cloud Firestore (path-based security rules)                             |
| **Styling**          | CSS custom properties (`--bluesky-*` theme) + Tailwind (light DOM only) |
| **Testing**          | Vitest (happy-dom) + Playwright (Chromium)                              |
| **UI Library**       | WebAwesome (buttons, spinners, avatars, icons)                          |

## Quick Start

### Standalone mock frontend

```sh
npm install
npm run dev        # starts Vite dev server on port 3000 (mock services by default)
```

Mock services are enabled when `VITE_USE_MOCK_SERVICES=true` (the default). This gives you a fully functional UI with hardcoded feed data — no Firebase or backend required.

### Full local stack

```sh
cd ../internal-tools/devenv
./devctl bootstrap
```

The shared development environment runs the frontend against the local API,
Firebase Auth and Firestore emulators, seeded Bluesky data, and the real
inference service without requiring credentials. It disables frontend mock
services, supplies the emulator configuration, and keeps Vite hot reload
enabled.

After bootstrap, run `./devctl login`, open the printed local sign-in URL, run
`./devctl feed`, and reload the frontend to see a feed snapshot. The UI's
handle-based sign-in is also backed by the credential-free local auth shim.

Run `./devctl pull` from `internal-tools/devenv` to safely fetch and
fast-forward sibling repositories at the start of a task. To test the local
feeds through a real Bluesky account, configure the ngrok token, development
account handle, and Bluesky app password described in the local environment
guide, then use `./devctl bsky up`, `./devctl bsky status`, and
`./devctl bsky down`.

See the [local development environment guide](Documentation/LOCAL_DEV_ENVIRONMENT.md)
for setup, frontend test commands, and troubleshooting. Developers working
specifically on the real Bluesky OAuth flow should use the
[local OAuth testing guide](Documentation/LOCAL_OAUTH_TEST.md).

### Firebase emulators

This repository is the canonical owner of all Firebase configuration. Start all
configured emulators here with `npm run emulators`, or start only Firestore for
API development with `npm run emulators:firestore`. Both frontend and API local
clients use the `greenearth-471522` emulator project namespace; an emulator host
setting keeps this traffic local rather than sending it to production.

## Architecture

```
src/
  services/         → Service interfaces (IAuthService, IFeedApiService)
  │                    + 3 implementations: Mock, Firebase, API proxy
  │                    + ServiceProvider DI bag
  stores/           → MobX stores: Auth, Account, Feed, UI
  │                    Never import Firebase or HTTP directly
  │                    RootStore owns everything + ServiceProvider
  models/           → Domain types (feed snapshots, Bluesky accounts, scores)
  components/       → Lit web components (app-shell, feed cards, charts, sliders)
  pages/            → Page-level Lit components (feed, controls, how-it-works, settings)
  styles/           → Global CSS custom properties (Bluesky theme)
  main.ts           → Entry point; getRootStore() is the DI accessor
  utils/            → Utility functions (relative time formatting)
```

### Dependency Injection

`main.ts` is the composition root. It reads `VITE_USE_MOCK_SERVICES` at startup and wires up either mock or real service implementations into a `ServiceProvider`, which is passed to `RootStore`. All stores and components access services exclusively through the store hierarchy — they never import Firebase, atproto, or HTTP modules directly.

```ts
// Any component can access the full store tree:
import { getRootStore } from "../main";
const rootStore = getRootStore();
```

### Routing

Hash-based SPA routing handled entirely in `app-shell.ts`:

| Hash             | Page          | Description                                             |
| ---------------- | ------------- | ------------------------------------------------------- |
| `#/feed`         | Feed Page     | Default. Post observability feed with tabs + pagination |
| `#/feedback`     | Feedback      | Custom PostHog-backed feedback form                     |
| `#/settings`     | Settings      | Feed-specific controls and pipeline explanations        |
| `#/controls`     | Redirect      | Legacy route; history-replaced with `#/settings`        |
| `#/how-it-works` | Redirect      | Legacy route; history-replaced with `#/settings`        |
| `#/auth/finish?token=...` | (inline) | OAuth callback handler                            |

## Product analytics

The frontend uses one shared PostHog client for product events and manual
survey submissions. Network capture is enabled only by the production runtime
configuration; stage, local development, mocks, and tests use no-op analytics.
Autocapture, generic pageviews, exception capture, heatmaps, and session replay
are disabled.

Custom product events are `signInCompleted`, `signInFailed`,
`feedControlChanged`, `feedControlChangeFailed`, `controlHelpOpened`,
`howItWorksViewed`, `howItWorksComponentClicked`, and
`postOpenedInBluesky`. Every event includes the frontend surface, environment,
release SHA, sanitized app route, and schema version. Users are identified by
their Bluesky DID and reset on logout. Event payloads must never include OAuth
tokens, entered handles, raw errors, post content, or author details.

Feed-specific events use the API feed rkey in `feed_name` (`your-feed`,
`best-of-friends`, or `random`) plus a human-readable `feed_label`. The three
feedback surfaces continue to use three PostHog surveys across all feeds.
Survey responses are segmented with `feedback_context_key` (`<surface>:<feed>`)
and a unique `feedback_submission_id`. They include the selected feed's
`api_release_sha` (not the frontend build SHA); detailed snapshot metadata is
included only when the loaded snapshot belongs to the selected feed.

Route changes trigger a scroll-to-top on the center column.

### Responsive Layout

Responsive layout managed by `app-shell`:

| Breakpoint        | Behavior                                                             |
| ----------------- | -------------------------------------------------------------------- |
| **< 1024px**      | Left sidebar hidden; hamburger drawer menu; center column full width |
| **1024px–1199px** | Left sidebar visible (275px); center column max 600px                |
| **≥ 1200px**      | Left sidebar and centered post list remain visible                   |

### OAuth Flow

```
User clicks "Sign in with Bluesky"
  → GET /auth/bluesky?return_url=/feed            (Cloud Function: authBluesky)
  → Redirect to Bluesky's authorization page
  → User consents
  → Bluesky redirects to /oauth/callback           (Cloud Function: oauthCallback)
  → Exchanges code, mints Firebase custom token
  → Redirects to /#/auth/finish?token=...          (app-shell handles this)
  → signInWithCustomToken(token)                   (FirebaseAuthService)
  → Redirect to #/feed
```

Cloud Functions live in `functions/src/auth/` and serve:

- `oauthClientMetadata` → `/oauth-client-metadata.json`
- `oauthJwks` → `/.well-known/jwks.json`
- `authBluesky` → `GET /auth/bluesky`
- `oauthCallback` → `GET /oauth/callback`

The Vite dev server proxies these to the Firebase Functions emulator on port 5001.

## Shadow DOM and Styling

Lit components use Shadow DOM. **Tailwind class names do not penetrate shadow roots.** All component styling must use explicit CSS in the `static styles` block. CSS custom properties (`var(--bluesky-*)`) pass through Shadow DOM boundaries and are the primary mechanism for theme consistency.

The Bluesky dark theme variables are defined in `src/styles/index.css` and include `--bluesky-bg`, `--bluesky-surface`, `--bluesky-text`, `--bluesky-accent`, etc.

## Key Components

| Component            | Tag                    | Role                                                               |
| -------------------- | ---------------------- | ------------------------------------------------------------------ |
| `app-shell`          | `<app-shell>`          | Main layout, routing, sidebar nav, user menu, OAuth finish handler |
| `feed-view`          | `<feed-view>`          | Renders list of `<feed-item-card>` components                      |
| `feed-item-card`     | `<feed-item-card>`     | Single post: author, content, score chart, generator badges        |
| `feed-tabs`          | `<feed-tabs>`          | Horizontal scrollable tab bar with gradient fade edges             |
| `icon-range-slider`  | `<icon-range-slider>`  | Accessible horizontal/vertical slider with a dynamic thumb icon    |
| `rank-scores-chart`  | `<rank-scores-chart>`  | Score axis chart showing model scores on -1 to +1                  |
| `generator-badge`    | `<generator-badge>`    | Colored pill badge for feed generator names + scores               |
| `pagination-control` | `<pagination-control>` | Page buttons, ellipsis, per-page selector                          |
| `icon-library`       | `<icon-library>`       | Registers 30+ custom SVG icons with WebAwesome                     |

## Firestore Security Rules

Rules, composite indexes, TTL policies, emulator settings, Functions, and
Hosting configuration are all deployed from this repository. API deployments
do not modify Firebase state.

Path-based read-only access. Each user can only read their own documents:

```
/users/{docId}                      → allow read if uid matches
/users/{docId}/feed_debug/{reqId}   → allow read if uid matches
everything else                     → deny
```

The `docId` is the user's DID with the `did:plc:` prefix stripped.

## Environment Variables

| Variable                      | Default             | Description                                       |
| ----------------------------- | ------------------- | ------------------------------------------------- |
| `VITE_USE_MOCK_SERVICES`      | `true`              | Use mock auth + feed data (no Firebase)           |
| `VITE_USE_FIREBASE_EMULATORS` | `true`              | Connect Firebase SDK to local emulators           |
| `VITE_FIREBASE_PROJECT_ID`    | `greenearth-471522` | Firebase project                                  |
| `VITE_FIREBASE_API_KEY`       | —                   | Web app API key                                   |
| `VITE_FIREBASE_AUTH_DOMAIN`   | —                   | Auth domain                                       |
| `VITE_FIREBASE_APP_ID`        | —                   | Web app ID                                        |
| `VITE_ALLOWED_HOSTS`          | `localhost`         | Vite dev server allowed hosts (for ngrok tunnels) |
| `VITE_API_BASE_URL`           | `""`                | Backend API base URL                              |

The Firestore database name is loaded at runtime from `/public/config.json`, allowing the same SPA bundle to target different databases per environment (e.g., `greenearth-stage` vs `greenearth-prod`).

## Commands

```sh
npm run dev          # Vite dev server (port 3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --ext .ts
npm run format       # prettier --write "src/**/*.ts"
npm run test:unit    # vitest run (happy-dom)
npm run test:e2e     # playwright test (Chromium)
npm run emulators    # Auth + Firestore + Functions emulators
npm run emulators:firestore # Firestore only, including for API development
```

CI pipeline runs: `lint` → `typecheck` → `test:unit` → `test:e2e` → `build`

## TypeScript Configuration

- `experimentalDecorators: true` — Lit decorators (`@customElement`, `@property`)
- `useDefineForClassFields: false` — required by MobX `makeAutoObservable`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array index access may be `undefined`
- `strict: true` is fully enabled

## Further Reading

- `AGENTS.md` — Development conventions, service tables, component patterns
- [Local development environment](Documentation/LOCAL_DEV_ENVIRONMENT.md) — Credential-free full-stack frontend development with `devctl`
- [Local OAuth testing](Documentation/LOCAL_OAUTH_TEST.md) — Real Bluesky OAuth testing with a public callback origin and client keys
- [CI/CD](Documentation/CI_CD.md) — Pipeline, environment strategy, and deployment

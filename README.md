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

```sh
npm install
npm run dev        # starts Vite dev server on port 3000 (mock services by default)
```

Mock services are enabled when `VITE_USE_MOCK_SERVICES=true` (the default). This gives you a fully functional UI with hardcoded feed data — no Firebase or backend required.

To run against real Firebase, the API backend, and BlueSky OAuth locally:

```sh
VITE_USE_MOCK_SERVICES=false VITE_USE_FIREBASE_EMULATORS=true npm run dev
```

See `Documentation/LOCAL_OAUTH_TEST.md` for full instructions.

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

| Hash                      | Page          | Description                                             |
| ------------------------- | ------------- | ------------------------------------------------------- |
| `#/feed`                  | Feed Page     | Default. Post observability feed with tabs + pagination |
| `#/controls`              | Controls Page | Social Radius slider + future controls                  |
| `#/how-it-works`          | How It Works  | Interactive algorithm diagram                           |
| `#/settings`              | Settings      | Placeholder                                             |
| `#/auth/finish?token=...` | (inline)      | OAuth callback handler                                  |

Route changes trigger a scroll-to-top on the center column.

### Responsive Layout

Three-column layout managed by `app-shell`:

| Breakpoint        | Behavior                                                             |
| ----------------- | -------------------------------------------------------------------- |
| **< 1024px**      | Left sidebar hidden; hamburger drawer menu; center column full width |
| **1024px–1199px** | Left sidebar visible (275px); center column max 600px                |
| **≥ 1200px**      | Right sidebar visible (350px); full three-column layout              |

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
| `lifecycle-slider`   | `<lifecycle-slider>`   | 5-stage draggable slider (eggs → butterfly) for Social Radius      |
| `rank-scores-chart`  | `<rank-scores-chart>`  | Score axis chart showing model scores on -1 to +1                  |
| `generator-badge`    | `<generator-badge>`    | Colored pill badge for feed generator names + scores               |
| `pagination-control` | `<pagination-control>` | Page buttons, ellipsis, per-page selector                          |
| `right-sidebar`      | `<right-sidebar>`      | Feed snapshot list panel                                           |
| `icon-library`       | `<icon-library>`       | Registers 30+ custom SVG icons with WebAwesome                     |

## Firestore Security Rules

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
- `Documentation/CI_CD.md` — CI/CD pipeline, environment strategy, deployment
- `Documentation/LOCAL_OAUTH_TEST.md` — Step-by-step local OAuth E2E test guide

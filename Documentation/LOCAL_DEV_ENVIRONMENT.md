# Frontend development with the local stack

Use the shared development environment when frontend work needs the real local
API, Firebase Auth and Firestore emulators, seeded feed data, or the inference
service. It runs the complete stack through Docker Compose and does not require
GCP, Firebase, Bluesky OAuth, or production credentials.

For UI work that only needs hardcoded data, the standalone mock workflow in the
[README](../README.md#standalone-mock-frontend) is faster.

## Prerequisites

- Docker with Compose v2 (`docker compose version`)
- About 5 GB of memory available to Docker
- `git`, `python3`, and `curl`
- The required repositories checked out as siblings under one parent directory:

```text
greenearth/
  api/
  frontend/             # this repository
  inference-service/
  ingex/
  internal-tools/
```

No host installation of Node, Go, or the services' Python dependencies is
needed. The development environment installs and runs those dependencies in
containers.

If the repositories are not siblings, configure `GE_DEV_REPO_ROOT` in
`internal-tools/devenv/devenv.local.env`. See the
[internal-tools onboarding guide](https://github.com/greenearth-social/internal-tools/blob/main/devenv/docs/onboarding.md)
for cloning instructions and other supported layouts.

## First-time setup

From the directory that contains the sibling repositories:

```sh
cd internal-tools/devenv
./devctl bootstrap
```

`bootstrap` builds the development images, downloads the pinned models and
sample data, starts the stack, and seeds Elasticsearch. It is resumable, so run
the same command again after fixing any reported failure. Allow roughly 20–30
minutes for the first run.

When it completes:

1. Print a local sign-in URL for the seeded development persona:

   ```sh
   ./devctl login
   ```

2. Open the printed URL. It signs the browser into the Firebase Auth emulator
   with a local-only token and opens the Vite frontend.
3. Create a feed snapshot:

   ```sh
   ./devctl feed
   ```

4. Reload the frontend. The transparency UI will show the feed the local API
   served to the seeded development persona.

You can instead open <http://127.0.0.1:3000>, enter a Bluesky handle, and select
**Continue**. The credential-free `dev-auth` shim resolves the handle and signs
it into the emulator without starting the production OAuth flow. Find the
resolved DID in `./devctl logs dev-auth`, then generate a snapshot for that
identity:

```sh
./devctl feed your-feed --user did:plc:...
```

Feed snapshots are retained for about 15 minutes. If the UI becomes empty, run
`./devctl feed` again and reload.

## Daily frontend workflow

Run these commands from `internal-tools/devenv`:

```sh
./devctl up
./devctl status
```

The frontend checkout is bind-mounted into the Vite container. Vite hot reload
is always enabled, so saved frontend changes appear without restarting the
stack.

Run the frontend unit suite:

```sh
./devctl test frontend
```

Use `exec` for individual frontend development commands:

```sh
./devctl exec frontend npm run lint
./devctl exec frontend npm run typecheck
./devctl exec frontend npm run test:unit
./devctl exec frontend npm run build
```

The frontend service must be running before `test frontend` or `exec frontend`.
Start it with `./devctl up` if needed. Use `./devctl down` to stop the stack
without deleting its data.

## How the frontend is configured

The shared environment deliberately differs from the standalone frontend
defaults:

- It sets `VITE_USE_MOCK_SERVICES=false`, so plausible-looking mock cards cannot
  be mistaken for seeded data.
- It injects placeholder Firebase web configuration and connects the browser to
  the local Auth and Firestore emulators.
- It supplies the correct host-side emulator ports, including the allocated
  ports used by named parallel environments.
- It proxies the Vite API and Functions requests to the corresponding
  containers.
- It derives a Firebase emulator configuration from this repository's deployed
  rules and Functions configuration.

Do not create a frontend `.env.local` for this workflow. `devctl` supplies the
container environment, and the local services require no credentials. The
manual variables in `.env.example` remain useful for running Vite directly or
for specialized Firebase work outside the shared environment.

Real Bluesky OAuth development is a separate workflow because the authorization
server needs a public callback origin and private client keys. See
[Local OAuth testing](LOCAL_OAUTH_TEST.md) and the
[internal-tools OAuth notes](https://github.com/greenearth-social/internal-tools/blob/main/devenv/README.md#working-on-real-bluesky-auth).

## Diagnostics

Start with the environment's built-in checks:

```sh
./devctl doctor
./devctl status
```

For frontend-specific problems:

```sh
./devctl logs frontend
./devctl logs -t frontend
./devctl restart frontend
```

`restart frontend` recreates the frontend container and picks up configuration
changes. It is normally unnecessary for source edits because Vite hot reloads
them.

Common cases:

- If the browser shows convincing posts that do not change after a seed, check
  that `GE_DEV_FRONTEND_MOCK` is not set to `true`.
- If the frontend is empty, create a fresh snapshot with `./devctl feed` and
  reload. Also check `./devctl status` for an expired data seed.
- If the first start appears idle, follow `./devctl logs -t frontend`; the
  container may still be installing npm dependencies into its cached volume.
- If a port is already in use, run `./devctl ports` and follow the environment's
  suggested override or named-instance guidance.

For full-stack diagnosis, see the
[internal-tools troubleshooting guide](https://github.com/greenearth-social/internal-tools/blob/main/devenv/docs/troubleshooting.md).

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_SERVICES?: string;
  readonly VITE_MOCK_AUTH?: string;
  // Emulator endpoint, set by the shared dev environment when it runs more
  // than one instance. Unset means the standard 127.0.0.1:9099 / :8080.
  readonly VITE_FIREBASE_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_PORT?: string;
  readonly VITE_FIRESTORE_EMULATOR_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

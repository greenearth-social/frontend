import "./styles/index.css";

import { RootStore } from "./stores/root-store";
import type { ServiceProvider } from "./services/service-provider";
import { initFirestore } from "./services/firebase/firebase-init";

const useMock = import.meta.env.VITE_USE_MOCK_SERVICES !== "false";

let rootStore: RootStore | null = null;

export function getRootStore(): RootStore | null {
  return rootStore;
}

async function init() {
  let services: ServiceProvider;

  if (useMock) {
    const { MockAuthService, MockFeedDebugService, MockHydrationService } =
      await import("./services/mock");

    services = {
      authService: new MockAuthService(),
      feedDebugService: new MockFeedDebugService(),
      hydrationService: new MockHydrationService(),
    };
  } else {
    // Load runtime config for database name
    const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
    if (!useEmulators) {
      try {
        const res = await fetch("/config.json");
        if (res.ok) {
          const config = (await res.json()) as { firestoreDatabase?: string };
          if (config.firestoreDatabase) {
            initFirestore(config.firestoreDatabase);
          }
        }
      } catch {
        // Fall back to default database if config.json is unavailable
      }
    }

    const { FirebaseAuthService } = await import(
      "./services/firebase/firebase-auth-service"
    );
    const { FirestoreFeedDebugService } = await import(
      "./services/firebase/firestore-feed-debug-service"
    );
    const { CloudFunctionHydrationService } = await import(
      "./services/api/cloud-function-hydration-service"
    );

    services = {
      authService: new FirebaseAuthService(),
      feedDebugService: new FirestoreFeedDebugService(),
      hydrationService: new CloudFunctionHydrationService(),
    };
  }

  const root = new RootStore(services);
  rootStore = root;

  await import("./components/app-shell");
}

void init();

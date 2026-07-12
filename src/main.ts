import "./styles/index.css";

import { setBasePath } from "@awesome.me/webawesome";
import "./components/icon-library";
import { RootStore } from "./stores/root-store";
import type { ServiceProvider } from "./services/service-provider";

setBasePath("/");

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
    const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
    const { initFirestore } = await import("./services/firebase/firebase-init");
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
        // Fall back to default database
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

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
    const { MockAuthService, MockFeedApiService } =
      await import("./services/mock");

    services = {
      authService: new MockAuthService(),
      feedApiService: new MockFeedApiService(),
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
    const { FeedApiService } = await import(
      "./services/api/feed-api-service"
    );

    const apiBaseUrl: string = (import.meta.env.VITE_API_BASE_URL as string) || "";

    const authService = new FirebaseAuthService();

    services = {
      authService,
      feedApiService: new FeedApiService(apiBaseUrl, () => authService.getIdToken()),
    };
  }

  const root = new RootStore(services);
  rootStore = root;

  await import("./components/app-shell");
}

void init();

import "./styles/index.css";

import { setBasePath } from "@awesome.me/webawesome";
import "./components/icon-library";
import { RootStore } from "./stores/root-store";
import type { ServiceProvider } from "./services/service-provider";
import { loadRuntimeConfig } from "./config/runtime-config";
import { createFeedbackService } from "./services/feedback/feedback-service";
import { createAnalyticsService } from "./services/analytics/analytics-service";

setBasePath("/");

const useMock = import.meta.env.VITE_USE_MOCK_SERVICES !== "false";

let rootStore: RootStore | null = null;

export function getRootStore(): RootStore | null {
  return rootStore;
}

async function init() {
  const runtimeConfig = await loadRuntimeConfig();
  const analyticsService = await createAnalyticsService(runtimeConfig);
  const feedbackService = createFeedbackService(runtimeConfig, analyticsService);
  let services: ServiceProvider;

  if (useMock) {
    const { MockAuthService, MockFeedApiService } =
      await import("./services/mock");

    services = {
      authService: new MockAuthService(),
      feedApiService: new MockFeedApiService(),
      analyticsService,
      feedbackService,
    };
  } else {
    const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
    const { initFirestore } = await import("./services/firebase/firebase-init");
    if (!useEmulators && runtimeConfig.firestoreDatabase) {
      initFirestore(runtimeConfig.firestoreDatabase);
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
      analyticsService,
      feedbackService,
    };
  }

  const root = new RootStore(services);
  rootStore = root;

  await import("./components/app-shell");
}

void init();

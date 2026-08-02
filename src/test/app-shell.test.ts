import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    authStore: {
      isSignedIn: true,
      currentUser: { uid: "did:plc:alice" },
      signInWithCustomToken: vi.fn<() => Promise<void>>(),
      signOut: vi.fn<() => Promise<void>>(),
    },
    accountStore: {
      activeAccount: {
        displayName: "Alice",
        handle: "alice.test",
      },
    },
    feedStore: {
      feedList: [
        {
          requestId: "r1",
          generatedAt: new Date().toISOString(),
          feedName: "your-feed",
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
        {
          requestId: "r2",
          generatedAt: new Date().toISOString(),
          feedName: "best-of-friends",
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
      items: [],
      feedListLoadState: "loading",
      isLoading: true,
      error: null,
      currentRequestId: null,
      currentApiReleaseSha: null,
      filteringCountsByRequest: {},
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      postsPerPage: 10,
      loadFeedList: vi.fn(),
      loadFeedDetail: vi.fn(),
      clearFeedDetail: vi.fn(),
    },
    uiStore: {
      selectedItemUri: null,
      selectedAlgorithm: "your-feed" satisfies "your-feed" | "best-of-friends" | "random",
      setSelectedAlgorithm: vi.fn(),
      clearSelectedAlgorithm: vi.fn(),
    },
    preferencesStore: {
      values: { socialRadius: 3, freshness: 5, politics: 1, purpose: 0.5 },
      socialRadiusWeights: [
        { name: "followed_users", weight: 0.4 },
        { name: "two_tower", weight: 0.3 },
        { name: "popularity", weight: 0.3 },
      ],
      load: vi.fn().mockResolvedValue(undefined),
    },
    feedbackStore: {
      mode: "test",
      unavailableReason: null,
      unavailableReasonFor: vi.fn().mockReturnValue(null),
    },
    services: {
      analyticsService: {
        identify: vi.fn(),
        capture: vi.fn(),
      },
    },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import { AppShell } from "../components/app-shell";

describe("AppShell authentication UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.location.hash = "/feed";
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.authStore.signOut.mockReset();
    testState.rootStore.authStore.signOut.mockResolvedValue(undefined);
    testState.rootStore.authStore.signInWithCustomToken.mockReset();
    testState.rootStore.authStore.signInWithCustomToken.mockResolvedValue(undefined);
    testState.rootStore.services.analyticsService.capture.mockReset();
    testState.rootStore.feedStore.feedListLoadState = "loading";
    testState.rootStore.feedStore.isLoading = true;
    testState.rootStore.feedStore.loadFeedList.mockReset();
  });

  it("centers the completing-sign-in state without relying on global utility styles", async () => {
    window.location.hash = "/auth/finish";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".auth-progress")?.textContent).toContain(
      "Completing sign in",
    );
    expect(AppShell.styles.cssText).toMatch(
      /\.auth-progress\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    );
  });

  it("closes the mobile drawer before signing out", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const feedPage = element.shadowRoot?.querySelector("feed-page");
    await feedPage?.updateComplete;
    feedPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".drawer")?.classList.contains("open")).toBe(true);

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".drawer .more-btn")
      ?.click();
    await element.updateComplete;
    testState.rootStore.authStore.signOut.mockImplementation(() => {
      expect(element.shadowRoot?.querySelector(".drawer")?.classList.contains("open")).toBe(false);
      return Promise.resolve();
    });
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".drawer .logout-btn")
      ?.click();

    await vi.waitFor(() => {
      expect(testState.rootStore.authStore.signOut).toHaveBeenCalledOnce();
    });
  });

  it.each(["/controls", "/how-it-works", "/feedback"])(
    "returns signed-out users from %s to the sign-in landing page",
    async (route) => {
      window.location.hash = route;
      testState.rootStore.authStore.signOut.mockImplementation(() => {
        testState.rootStore.authStore.isSignedIn = false;
        return Promise.resolve();
      });
      const element = document.createElement("app-shell");
      document.body.appendChild(element);
      await element.updateComplete;

      element.shadowRoot
        ?.querySelector<HTMLButtonElement>(".left-sidebar-desktop .more-btn")
        ?.click();
      await element.updateComplete;
      element.shadowRoot
        ?.querySelector<HTMLButtonElement>(".left-sidebar-desktop .logout-btn")
        ?.click();

      await vi.waitFor(() => {
        expect(window.location.hash).toBe("#/feed");
        expect(element.shadowRoot?.querySelector(".left-sidebar-desktop")).toBeNull();
      });
      const feedPage = element.shadowRoot?.querySelector("feed-page");
      await feedPage?.updateComplete;
      expect(feedPage?.shadowRoot?.querySelector(".logged-out-page")).not.toBeNull();
    },
  );

  it("does not reload a successfully loaded empty feed list on later updates", async () => {
    testState.rootStore.feedStore.feedListLoadState = "idle";
    testState.rootStore.feedStore.isLoading = false;
    testState.rootStore.feedStore.loadFeedList.mockImplementation(() => {
      testState.rootStore.feedStore.feedListLoadState = "loaded";
      return Promise.resolve();
    });
    const element = document.createElement("app-shell");

    document.body.appendChild(element);
    await element.updateComplete;
    element.requestUpdate();
    await element.updateComplete;

    expect(testState.rootStore.feedStore.loadFeedList).toHaveBeenCalledOnce();
  });

  it("routes signed-in users to the Feedback page from the shared navigation", async () => {
    window.location.hash = "/feedback";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(
      Array.from(element.shadowRoot?.querySelectorAll(".nav-label") ?? []).map(
        (label) => label.textContent,
      ),
    ).toContain("Feedback");
    const page = element.shadowRoot?.querySelector("feedback-page");
    await page?.updateComplete;
    const form = page?.shadowRoot?.querySelector("feedback-form");

    expect(form?.prompt).toBe("We'd love to know what you think of GreenEarth");
    expect(form?.selectedFeed).toBe("your-feed");
  });

  it("captures one How It Works view when entering the route", async () => {
    window.location.hash = "/how-it-works";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledOnce();
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "howItWorksViewed",
      {
        feed_name: "your-feed",
        feed_label: "GreenEarth",
      },
    );

    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledOnce();
  });

  it("captures a completed sign-in without exposing the callback token", async () => {
    window.location.hash = "/auth/finish?token=secret-token&return_url=/controls";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);

    await vi.waitFor(() => {
      expect(testState.rootStore.authStore.signInWithCustomToken).toHaveBeenCalledWith(
        "secret-token",
      );
      expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
        "signInCompleted",
        {
          auth_method: "bluesky_oauth",
          return_route: "/controls",
        },
      );
    });
    expect(
      JSON.stringify(testState.rootStore.services.analyticsService.capture.mock.calls),
    ).not.toContain("secret-token");
  });

  it("captures a bounded callback failure", async () => {
    testState.rootStore.authStore.signInWithCustomToken.mockRejectedValue(
      new Error("raw provider failure"),
    );
    window.location.hash = "/auth/finish?token=secret-token";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);

    await vi.waitFor(() => {
      expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
        "signInFailed",
        {
          failure_stage: "callback",
          error_category: "token_exchange_failed",
        },
      );
    });
    expect(
      JSON.stringify(testState.rootStore.services.analyticsService.capture.mock.calls),
    ).not.toContain("raw provider failure");
  });
});

describe("AppShell algorithm selector", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.location.hash = "/feed";
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.uiStore.selectedAlgorithm = "your-feed";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockReset();
    testState.rootStore.feedStore.loadFeedDetail.mockReset();
    testState.rootStore.feedStore.feedListLoadState = "loading";
    testState.rootStore.feedStore.isLoading = true;
    testState.rootStore.feedStore.loadFeedList.mockReset();
  });

  it("renders four algorithm buttons including Latest", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // query within the desktop sidebar to avoid double-counting the drawer
    const buttons = element.shadowRoot?.querySelectorAll(".left-sidebar-desktop .algo-btn");
    expect(buttons?.length).toBe(4);
  });

  it("marks the active algorithm button", async () => {
    testState.rootStore.uiStore.selectedAlgorithm = "best-of-friends";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // query within the desktop sidebar to avoid double-counting the drawer
    const active = element.shadowRoot?.querySelectorAll(".left-sidebar-desktop .algo-btn.active");
    expect(active?.length).toBe(1);
    expect(active?.[0]?.getAttribute("aria-label")).toBe("Best of Friends");
  });

  it("calls setSelectedAlgorithm and loadFeedDetail on click", async () => {
    testState.rootStore.uiStore.selectedAlgorithm = "your-feed";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockReset();
    testState.rootStore.feedStore.loadFeedDetail.mockReset();
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // click through the desktop sidebar buttons
    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".left-sidebar-desktop .algo-btn");
    const friendsBtn = Array.from(buttons ?? []).find(
      (b) => b.getAttribute("aria-label") === "Best of Friends",
    );
    friendsBtn?.click();
    await element.updateComplete;

    expect(testState.rootStore.uiStore.setSelectedAlgorithm).toHaveBeenCalledWith("best-of-friends");
    expect(testState.rootStore.feedStore.loadFeedDetail).toHaveBeenCalledWith("r2");
  });

  it("keeps the current page and updates its feedback feed context", async () => {
    window.location.hash = "/feedback";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockImplementation((
      id: "your-feed" | "best-of-friends" | "random",
    ) => {
      testState.rootStore.uiStore.selectedAlgorithm = id;
    });
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      ".left-sidebar-desktop .algo-btn",
    );
    Array.from(buttons ?? [])
      .find((button) => button.getAttribute("aria-label") === "Best of Friends")
      ?.click();
    await element.updateComplete;

    const page = element.shadowRoot?.querySelector("feedback-page");
    await page?.updateComplete;
    const form = page?.shadowRoot?.querySelector("feedback-form");
    expect(window.location.hash).toBe("#/feedback");
    expect(page?.selectedAlgorithm).toBe("best-of-friends");
    expect(form?.selectedFeed).toBe("best-of-friends");
    expect(form?.shadowRoot?.textContent).toContain("Feed: Best of Friends");
  });

  it("selects the most recent feed when multiple feeds have the same feedName", async () => {
    // Simulate a scenario where the same feed was run twice.
    // The most recent run should be first (index 0).
    testState.rootStore.feedStore.feedList = [
      {
        requestId: "r1-recent",
        generatedAt: new Date().toISOString(),
        feedName: "your-feed",
        appliedSocialRadius: null,
        generatorDiagnostics: [],
      },
      {
        requestId: "r1-old",
        generatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        feedName: "your-feed",
        appliedSocialRadius: null,
        generatorDiagnostics: [],
      },
    ];
    testState.rootStore.uiStore.selectedAlgorithm = "best-of-friends";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockReset();
    testState.rootStore.feedStore.loadFeedDetail.mockReset();
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // click the "your-feed" algorithm button (labeled "GreenEarth")
    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".left-sidebar-desktop .algo-btn");
    const yourFeedBtn = Array.from(buttons ?? []).find(
      (b) => b.getAttribute("aria-label") === "GreenEarth",
    );
    yourFeedBtn?.click();
    await element.updateComplete;

    // Should load the most recent one (r1-recent, which is at index 0)
    expect(testState.rootStore.uiStore.setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(testState.rootStore.feedStore.loadFeedDetail).toHaveBeenCalledWith("r1-recent");
  });
});

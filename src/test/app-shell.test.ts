import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    authStore: {
      isSignedIn: true,
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
      filteringCountsByRequest: {},
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      postsPerPage: 10,
      loadFeedList: vi.fn(),
      loadFeedDetail: vi.fn(),
    },
    uiStore: {
      selectedItemUri: null,
      selectedAlgorithm: "your-feed" satisfies "your-feed" | "best-of-friends" | "random",
      setSelectedAlgorithm: vi.fn(),
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

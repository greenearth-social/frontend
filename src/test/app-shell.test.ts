import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    authStore: {
      isInitialized: true,
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
      postsPerPage: 20,
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
      values: {
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 5,
        politics: 1,
        purpose: 0.5,
      },
      valuesFor() {
        return this.values;
      },
      socialRadiusWeights: [
        { name: "followed_users", weight: 0.4 },
        { name: "two_tower", weight: 0.3 },
        { name: "popularity", weight: 0.3 },
      ],
      socialRadiusWeightsFor() {
        return this.socialRadiusWeights;
      },
      supportsControl(
        feedName: "your-feed" | "best-of-friends" | "random",
        control: "source_weights" | "freshness" | "politics" | "purpose",
      ) {
        if (control === "source_weights") return feedName === "your-feed";
        if (control === "purpose") return feedName !== "random";
        return control === "freshness";
      },
      engagingWeightFor() {
        return 1 - this.values.purpose;
      },
      constructiveWeightFor() {
        return this.values.purpose;
      },
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
import { ALGORITHMS } from "../constants/algorithms";

describe("AppShell authentication UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.location.hash = "/feed";
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.authStore.isInitialized = true;
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
    let finishSignIn: (() => void) | undefined;
    testState.rootStore.authStore.signInWithCustomToken.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSignIn = resolve;
        }),
    );
    window.location.hash = "/auth/finish?token=test-token";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".auth-progress")?.textContent).toContain(
      "Completing sign in",
    );
    expect(AppShell.styles.cssText).toMatch(
      /\.auth-progress\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    );
    finishSignIn?.();
  });

  it("returns OAuth cancellation to the login form with a bounded message", async () => {
    testState.rootStore.authStore.isSignedIn = false;
    window.location.hash =
      "/auth/finish?error=access_denied&error_description=raw-provider-description";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);

    await vi.waitFor(() => {
      expect(window.location.hash).toBe("#/feed");
      const feedPage = element.shadowRoot?.querySelector("feed-page");
      expect(feedPage?.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
        "Sign in was canceled",
      );
    });
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "signInFailed",
      { failure_stage: "callback", error_category: "access_denied" },
    );
    expect(window.location.href).not.toContain("raw-provider-description");
  });

  it.each(["provider_error", "callback_failed", "unknown_error"])(
    "shows the generic login error for %s",
    async (error) => {
      testState.rootStore.authStore.isSignedIn = false;
      window.location.hash = `/auth/finish?error=${error}`;
      const element = document.createElement("app-shell");
      document.body.appendChild(element);

      await vi.waitFor(() => {
        const feedPage = element.shadowRoot?.querySelector("feed-page");
        expect(feedPage?.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
          "We couldn't sign you in",
        );
      });
      expect(window.location.hash).toBe("#/feed");
    },
  );

  it("recovers a callback with no token instead of spinning forever", async () => {
    testState.rootStore.authStore.isSignedIn = false;
    window.location.hash = "/auth/finish";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);

    await vi.waitFor(() => {
      expect(window.location.hash).toBe("#/feed");
      const feedPage = element.shadowRoot?.querySelector("feed-page");
      expect(feedPage?.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
        "We couldn't sign you in",
      );
    });
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "signInFailed",
      { failure_stage: "callback", error_category: "missing_token" },
    );
  });

  it("preserves a direct route while persisted authentication is initializing", async () => {
    window.location.hash = "/settings/random";
    testState.rootStore.authStore.isInitialized = false;
    testState.rootStore.authStore.isSignedIn = false;
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(window.location.hash).toBe("#/settings/random");
    expect(element.shadowRoot?.querySelector(".auth-progress")?.textContent).toContain(
      "Loading your account",
    );

    testState.rootStore.authStore.isInitialized = true;
    testState.rootStore.authStore.isSignedIn = true;
    element.requestUpdate();
    await vi.waitFor(() => {
      expect(element.shadowRoot?.querySelector("settings-page")).not.toBeNull();
    });
    expect(window.location.hash).toBe("#/settings/random");
  });

  it("routes desktop sidebar wheel gestures to the content panel", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const center = element.shadowRoot?.querySelector<HTMLElement>(".center-column");
    const sidebar = element.shadowRoot?.querySelector<HTMLElement>(".left-sidebar-desktop");
    if (!center || !sidebar) throw new Error("App shell columns did not render");
    center.scrollTop = 20;
    const sidebarWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      deltaY: 120,
    });

    sidebar.dispatchEvent(sidebarWheel);

    expect(center.scrollTop).toBe(140);
    expect(sidebarWheel.defaultPrevented).toBe(true);

    const contentWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      deltaY: 120,
    });
    center.dispatchEvent(contentWheel);
    expect(center.scrollTop).toBe(140);
    expect(contentWheel.defaultPrevented).toBe(false);

    const gutterWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -40,
    });
    element.dispatchEvent(gutterWheel);
    expect(center.scrollTop).toBe(100);
    expect(gutterWheel.defaultPrevented).toBe(true);

    const feedPage = element.shadowRoot?.querySelector("feed-page");
    await feedPage?.updateComplete;
    feedPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;
    const drawerWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    element.dispatchEvent(drawerWheel);
    expect(center.scrollTop).toBe(100);
    expect(drawerWheel.defaultPrevented).toBe(false);
  });

  it("keeps navigation collapse state across pages and exposes compact logout", async () => {
    window.location.hash = "/feed/your-feed";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const shell = element.shadowRoot?.querySelector(".shell-container");
    const toggle = element.shadowRoot?.querySelector<HTMLButtonElement>(".desktop-sidebar-toggle");
    expect(toggle?.getAttribute("aria-label")).toBe("Collapse navigation");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(shell?.classList.contains("sidebar-collapsed")).toBe(false);
    expect(AppShell.styles.cssText).toMatch(
      /\.desktop-sidebar-toggle\s*\{[^}]*top:\s*50%[^}]*height:\s*52px[^}]*border-radius:\s*6px[^}]*transform:\s*translateY\(-50%\)/s,
    );

    toggle?.click();
    await element.updateComplete;

    expect(shell?.classList.contains("sidebar-collapsed")).toBe(true);
    expect(toggle?.getAttribute("aria-label")).toBe("Expand navigation");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    element.shadowRoot
      ?.querySelector<HTMLAnchorElement>('.left-sidebar-desktop a[href="#/feedback/your-feed"]')
      ?.click();
    await vi.waitFor(() => {
      expect(window.location.hash).toBe("#/feedback/your-feed");
    });
    await element.updateComplete;
    expect(shell?.classList.contains("sidebar-collapsed")).toBe(true);
    expect(
      element.shadowRoot?.querySelector(".desktop-sidebar-toggle")?.getAttribute("aria-label"),
    ).toBe("Expand navigation");

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".left-sidebar-desktop .more-btn")
      ?.click();
    await element.updateComplete;
    const compactLogout = element.shadowRoot?.querySelector<HTMLButtonElement>(
      ".left-sidebar-desktop .logout-btn.compact",
    );
    expect(compactLogout?.getAttribute("aria-label")).toBe("Log out");
    expect(compactLogout?.querySelector("wa-icon")?.getAttribute("name")).toBe("lock");
    expect(AppShell.styles.cssText).toMatch(
      /\.logout-btn\s*\{[^}]*color:\s*var\(--bluesky-danger\)/s,
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

    element.shadowRoot?.querySelector<HTMLButtonElement>(".drawer .more-btn")?.click();
    await element.updateComplete;
    testState.rootStore.authStore.signOut.mockImplementation(() => {
      expect(element.shadowRoot?.querySelector(".drawer")?.classList.contains("open")).toBe(false);
      return Promise.resolve();
    });
    element.shadowRoot?.querySelector<HTMLButtonElement>(".drawer .logout-btn")?.click();

    await vi.waitFor(() => {
      expect(testState.rootStore.authStore.signOut).toHaveBeenCalledOnce();
    });
  });

  it("keeps the mobile drawer open for feed selection and closes it for subpages", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const feedPage = element.shadowRoot?.querySelector("feed-page");
    await feedPage?.updateComplete;
    feedPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;

    const drawer = element.shadowRoot?.querySelector<HTMLElement>(".drawer");
    expect(drawer?.classList.contains("open")).toBe(true);

    drawer?.querySelector<HTMLButtonElement>('.algo-btn[aria-label="Best of Friends"]')?.click();
    await element.updateComplete;
    expect(window.location.hash).toBe("#/feed/best-of-friends");
    expect(drawer?.classList.contains("open")).toBe(true);

    element.shadowRoot
      ?.querySelector<HTMLAnchorElement>('.drawer a[href="#/settings/best-of-friends"]')
      ?.click();
    await element.updateComplete;
    expect(window.location.hash).toBe("#/settings/best-of-friends");
    expect(drawer?.classList.contains("open")).toBe(false);

    const settingsPage = element.shadowRoot?.querySelector("settings-page");
    await settingsPage?.updateComplete;
    settingsPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;
    expect(drawer?.classList.contains("open")).toBe(true);

    element.shadowRoot
      ?.querySelector<HTMLAnchorElement>('.drawer a[href="#/feedback/best-of-friends"]')
      ?.click();
    await element.updateComplete;
    expect(window.location.hash).toBe("#/feedback/best-of-friends");
    expect(drawer?.classList.contains("open")).toBe(false);

    const feedbackPage = element.shadowRoot?.querySelector("feedback-page");
    await feedbackPage?.updateComplete;
    feedbackPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;
    expect(drawer?.classList.contains("open")).toBe(true);

    element.shadowRoot
      ?.querySelector<HTMLAnchorElement>('.drawer a[href="#/feed/best-of-friends"]')
      ?.click();
    await element.updateComplete;
    expect(window.location.hash).toBe("#/feed/best-of-friends");
    expect(drawer?.classList.contains("open")).toBe(false);

    const reopenedFeedPage = element.shadowRoot?.querySelector("feed-page");
    await reopenedFeedPage?.updateComplete;
    reopenedFeedPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;

    drawer?.querySelector<HTMLButtonElement>(".drawer-close")?.click();
    await element.updateComplete;
    expect(drawer?.classList.contains("open")).toBe(false);
  });

  it.each(["/settings", "/feedback"])(
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
      const logo = feedPage?.shadowRoot?.querySelector<HTMLImageElement>(".logged-out-logo");
      expect(logo?.getAttribute("src")).toBe("/assets/mysky-logo.png");
      expect(logo?.getAttribute("width")).toBe("640");
      expect(logo?.getAttribute("height")).toBe("476");
      expect(feedPage?.shadowRoot?.querySelector("style")?.textContent).toContain(
        "width: min(52vw, 190px)",
      );
      expect(AppShell.styles.toString()).toMatch(
        /wa-icon\[name\^="algo-"\][^}]*width:\s*2\.25rem/s,
      );
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

  it("captures one Settings view when entering the route", async () => {
    window.location.hash = "/settings";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledOnce();
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "settingsViewed",
      {
        feed_name: "your-feed",
        feed_label: "GreenEarth",
      },
    );

    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledOnce();
  });

  it.each(["/controls", "/how-it-works"])(
    "redirects the legacy %s route to Settings",
    async (route) => {
      window.location.hash = route;
      const element = document.createElement("app-shell");
      document.body.appendChild(element);
      await element.updateComplete;

      expect(window.location.hash).toBe("#/settings/your-feed");
      expect(element.shadowRoot?.querySelector("settings-page")).not.toBeNull();
      expect(
        Array.from(element.shadowRoot?.querySelectorAll(".nav-label") ?? []).map(
          (label) => label.textContent,
        ),
      ).toContain("Settings");
    },
  );

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
          return_route: "/settings/your-feed",
        },
      );
    });
    expect(
      JSON.stringify(testState.rootStore.services.analyticsService.capture.mock.calls),
    ).not.toContain("secret-token");
  });

  it("captures a bounded callback failure", async () => {
    testState.rootStore.authStore.isSignedIn = false;
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
    const feedPage = element.shadowRoot?.querySelector("feed-page");
    expect(feedPage?.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
      "We couldn't sign you in",
    );
  });

  it("does not process the same in-flight callback twice", async () => {
    let finishSignIn: (() => void) | undefined;
    testState.rootStore.authStore.signInWithCustomToken.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSignIn = resolve;
        }),
    );
    window.location.hash = "/auth/finish?token=secret-token";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await vi.waitFor(() => {
      expect(testState.rootStore.authStore.signInWithCustomToken).toHaveBeenCalledOnce();
    });

    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(testState.rootStore.authStore.signInWithCustomToken).toHaveBeenCalledOnce();
    finishSignIn?.();
  });
});

describe("AppShell algorithm selector", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.location.hash = "/feed";
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.authStore.isInitialized = true;
    testState.rootStore.uiStore.selectedAlgorithm = "your-feed";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockReset();
    testState.rootStore.feedStore.loadFeedDetail.mockReset();
    testState.rootStore.feedStore.feedListLoadState = "loading";
    testState.rootStore.feedStore.isLoading = true;
    testState.rootStore.feedStore.loadFeedList.mockReset();
  });

  it("renders three algorithm buttons without Latest", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // query within the desktop sidebar to avoid double-counting the drawer
    const buttons = element.shadowRoot?.querySelectorAll(".left-sidebar-desktop .algo-btn");
    expect(buttons?.length).toBe(3);
  });

  it("marks the active algorithm button", async () => {
    testState.rootStore.uiStore.selectedAlgorithm = "best-of-friends";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // query within the desktop sidebar to avoid double-counting the drawer
    const active = element.shadowRoot?.querySelectorAll(
      ".left-sidebar-desktop .algo-row.active .algo-btn",
    );
    expect(active?.length).toBe(1);
    expect(active?.[0]?.getAttribute("aria-label")).toBe("Best of Friends");
    expect(window.location.hash).toBe("#/feed/best-of-friends");
    expect(AppShell.styles.toString()).toMatch(
      /\.algo-row\.active\s*\{[^}]*color-mix\(in srgb, var\(--bluesky-brand\) 62%, #a8d3ff\)/s,
    );
    expect(AppShell.styles.toString()).toMatch(
      /\.algo-row\.active \.algo-label\s*\{[^}]*font-weight:\s*800/s,
    );
    expect(AppShell.styles.toString()).toMatch(
      /\.algo-btn\s*\{[^}]*gap:\s*0\.375rem[^}]*padding:\s*0\.625rem 0 0\.625rem 0\.375rem/s,
    );
  });

  it("calls setSelectedAlgorithm and loadFeedDetail on click", async () => {
    testState.rootStore.uiStore.selectedAlgorithm = "your-feed";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockReset();
    testState.rootStore.feedStore.loadFeedDetail.mockReset();
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    // click through the desktop sidebar buttons
    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      ".left-sidebar-desktop .algo-btn",
    );
    const friendsBtn = Array.from(buttons ?? []).find(
      (b) => b.getAttribute("aria-label") === "Best of Friends",
    );
    friendsBtn?.click();
    await element.updateComplete;

    expect(testState.rootStore.uiStore.setSelectedAlgorithm).toHaveBeenCalledWith(
      "best-of-friends",
    );
    expect(testState.rootStore.feedStore.loadFeedDetail).toHaveBeenCalledWith("r2");
  });

  it("keeps the current page and updates its feedback feed context", async () => {
    window.location.hash = "/feedback";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockImplementation(
      (id: "your-feed" | "best-of-friends" | "random") => {
        testState.rootStore.uiStore.selectedAlgorithm = id;
      },
    );
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
    expect(window.location.hash).toBe("#/feedback/best-of-friends");
    expect(page?.selectedAlgorithm).toBe("best-of-friends");
    expect(form?.selectedFeed).toBe("best-of-friends");
    expect(form?.shadowRoot?.textContent).toContain("Feed: Best of Friends");
  });

  it("does not render a Latest button in the algo selector", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const latestButtons = [...(element.shadowRoot?.querySelectorAll(".algo-btn") ?? [])].filter(
      (btn) => btn.textContent.includes("Latest"),
    );

    element.remove();
    expect(latestButtons).toHaveLength(0);
  });

  it("uses the canonical URL as the selected feed and page", async () => {
    window.location.hash = "/settings/random";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockImplementation(
      (id: "your-feed" | "best-of-friends" | "random") => {
        testState.rootStore.uiStore.selectedAlgorithm = id;
      },
    );
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const page = element.shadowRoot?.querySelector("settings-page");
    const activeLink = element.shadowRoot?.querySelector<HTMLAnchorElement>(
      '.left-sidebar-desktop .nav-link[aria-current="page"]',
    );
    expect(testState.rootStore.uiStore.setSelectedAlgorithm).toHaveBeenCalledWith("random");
    expect(page?.selectedAlgorithm).toBe("random");
    expect(activeLink?.getAttribute("href")).toBe("#/settings/random");
    expect(activeLink?.classList.contains("active")).toBe(true);
  });

  it("falls back to GreenEarth for an invalid canonical feed", async () => {
    window.location.hash = "/feedback/removed-feed";
    testState.rootStore.uiStore.setSelectedAlgorithm.mockImplementation(
      (id: "your-feed" | "best-of-friends" | "random") => {
        testState.rootStore.uiStore.selectedAlgorithm = id;
      },
    );
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(window.location.hash).toBe("#/feedback/your-feed");
    expect(testState.rootStore.uiStore.setSelectedAlgorithm).not.toHaveBeenCalled();
    expect(element.shadowRoot?.querySelector("feedback-page")?.selectedAlgorithm).toBe("your-feed");
  });

  it("keeps feed groups independently expandable with unique control ids", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const root = element.shadowRoot;
    const greenPages = root?.querySelector<HTMLElement>("#desktop-your-feed-pages");
    const friendsPages = root?.querySelector<HTMLElement>("#desktop-best-of-friends-pages");
    expect(greenPages?.hidden).toBe(false);
    expect(friendsPages?.hidden).toBe(true);
    expect(greenPages?.closest(".feed-group")?.classList.contains("active-feed")).toBe(true);
    expect(greenPages?.closest(".feed-group")?.classList.contains("expanded")).toBe(true);

    root
      ?.querySelector<HTMLButtonElement>(
        '.left-sidebar-desktop .algo-toggle[aria-label="Expand Best of Friends pages"]',
      )
      ?.click();
    await element.updateComplete;
    expect(greenPages?.hidden).toBe(false);
    expect(friendsPages?.hidden).toBe(false);
    expect(friendsPages?.closest(".feed-group")?.classList.contains("expanded")).toBe(true);

    root
      ?.querySelector<HTMLButtonElement>(
        '.left-sidebar-desktop .algo-toggle[aria-label="Collapse MySky pages"]',
      )
      ?.click();
    await element.updateComplete;
    expect(greenPages?.hidden).toBe(true);
    expect(friendsPages?.hidden).toBe(false);
    expect(greenPages?.closest(".feed-group")?.classList.contains("expanded")).toBe(false);

    const ids = Array.from(root?.querySelectorAll<HTMLElement>("[id$='-pages']") ?? []).map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toggles the active feed pages from its icon in collapsed desktop navigation", async () => {
    const feedLabel = ALGORITHMS["your-feed"].label;
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#/feed/your-feed`,
    );
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const pages = element.shadowRoot?.querySelector<HTMLElement>("#desktop-your-feed-pages");
    const feedGroup = pages?.closest<HTMLElement>(".feed-group");
    expect(feedGroup?.classList.contains("active-feed")).toBe(true);
    expect(pages?.hidden).toBe(false);

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(
        '.left-sidebar-desktop .desktop-sidebar-toggle[aria-label="Collapse navigation"]',
      )
      ?.click();
    await vi.waitFor(() => {
      expect(
        element.shadowRoot
          ?.querySelector(".shell-container")
          ?.classList.contains("sidebar-collapsed"),
      ).toBe(true);
      const collapseFeed = feedGroup?.querySelector<HTMLButtonElement>(".algo-btn");
      expect(collapseFeed).not.toBeNull();
      expect(collapseFeed?.getAttribute("aria-label")).toBe(`Collapse ${feedLabel} pages`);
      expect(collapseFeed?.getAttribute("aria-expanded")).toBe("true");
      expect(collapseFeed?.getAttribute("aria-controls")).toBe("desktop-your-feed-pages");
    });

    const collapseFeed = feedGroup?.querySelector<HTMLButtonElement>(".algo-btn");

    collapseFeed?.click();
    await vi.waitFor(() => {
      expect(pages?.hidden).toBe(true);
      const expandFeed = feedGroup?.querySelector<HTMLButtonElement>(".algo-btn");
      expect(expandFeed).not.toBeNull();
      expect(expandFeed?.getAttribute("aria-label")).toBe(`Expand ${feedLabel} pages`);
      expect(expandFeed?.getAttribute("aria-expanded")).toBe("false");
    });

    const expandFeed = feedGroup?.querySelector<HTMLButtonElement>(".algo-btn");
    expandFeed?.click();
    await vi.waitFor(() => {
      expect(pages?.hidden).toBe(false);
    });
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

    // click the "your-feed" algorithm button (labeled "MySky")
    const buttons = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      ".left-sidebar-desktop .algo-btn",
    );
    const yourFeedBtn = Array.from(buttons ?? []).find(
      (b) => b.getAttribute("aria-label") === "MySky",
    );
    yourFeedBtn?.click();
    await element.updateComplete;

    // Should load the most recent one (r1-recent, which is at index 0)
    expect(testState.rootStore.uiStore.setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(testState.rootStore.feedStore.loadFeedDetail).toHaveBeenCalledWith("r1-recent");
  });
});

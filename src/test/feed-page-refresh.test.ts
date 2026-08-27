import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItemView } from "../models/feed-debug-snapshot";

const testState = vi.hoisted(() => ({
  loadFeedList: vi.fn(),
  rootStore: {
    authStore: { isSignedIn: true },
    accountStore: { activeAccount: { did: "did:plc:test" } },
    feedStore: {
      isLoading: false,
      feedList: [] as Array<{
        requestId: string;
        generatedAt: string;
        feedName: "your-feed" | "best-of-friends" | "random";
      }>,
      currentRequestId: null as string | null,
      filteringCountsByRequest: {},
      error: null as string | null,
      items: [] as FeedItemView[],
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      postsPerPage: 20,
      loadFeedList: vi.fn(),
      refreshFeedIfNew: vi.fn(),
      loadFeedDetail: vi.fn(),
      goToPage: vi.fn(),
      setPostsPerPage: vi.fn(),
    },
    uiStore: {
      selectedAlgorithm: "random",
      selectedItemUri: null,
      setSelectedAlgorithm: vi.fn(),
      clearSelectedAlgorithm: vi.fn(),
      toggleSelectedItem: vi.fn(),
    },
    preferencesStore: {
      valuesFor: vi.fn(() => ({
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 5,
        purpose: 0.5,
        politics: 1,
      })),
    },
    services: { analyticsService: { capture: vi.fn() } },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../pages/feed-page";

function touchEvent(type: "touchstart" | "touchmove" | "touchend", x: number, y: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX: x, clientY: y }],
  });
  return event;
}

describe("FeedPage pull to refresh", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.stubGlobal("innerWidth", 375);
    testState.rootStore.feedStore.isLoading = false;
    testState.rootStore.feedStore.feedList = [];
    testState.rootStore.feedStore.items = [];
    testState.rootStore.feedStore.currentRequestId = null;
    testState.rootStore.feedStore.error = null;
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.accountStore.activeAccount.did = "did:plc:test";
    testState.rootStore.uiStore.selectedAlgorithm = "random";
    testState.rootStore.feedStore.loadFeedList.mockReset();
    testState.rootStore.feedStore.refreshFeedIfNew.mockReset();
    testState.rootStore.feedStore.refreshFeedIfNew.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("refreshes the feed selected by the current route after a downward pull", async () => {
    let finishRefresh: (() => void) | undefined;
    testState.rootStore.feedStore.loadFeedList.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const scrollContainer = document.createElement("main");
    const element = document.createElement("feed-page");
    scrollContainer.appendChild(element);
    document.body.appendChild(scrollContainer);
    await element.updateComplete;

    const header = element.shadowRoot?.querySelector(".sticky-header-wrapper");
    const gestureSurface = header?.parentElement;
    if (!gestureSurface) throw new Error("Feed gesture surface did not render");

    gestureSurface.dispatchEvent(touchEvent("touchstart", 100, 10));
    gestureSurface.dispatchEvent(touchEvent("touchmove", 102, 140));
    gestureSurface.dispatchEvent(touchEvent("touchend", 102, 140));
    await element.updateComplete;

    expect(testState.rootStore.feedStore.loadFeedList).toHaveBeenCalledWith({
      feedName: "random",
      force: true,
    });
    expect(element.shadowRoot?.querySelector(".pull-refresh")?.textContent).toContain(
      "Refreshing snapshots",
    );

    finishRefresh?.();
    await vi.waitFor(() => {
      expect(element.shadowRoot?.querySelector<HTMLElement>(".pull-refresh")?.style.height).toBe(
        "0px",
      );
    });
  });

  it("checks for a newer served snapshot when the WAIST route mounts", async () => {
    testState.rootStore.feedStore.feedList = [
      {
        requestId: "random-current",
        generatedAt: "2026-08-24T12:00:00Z",
        feedName: "random",
      },
    ];
    testState.rootStore.feedStore.refreshFeedIfNew.mockResolvedValue(false);

    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;

    await vi.waitFor(() => {
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledWith(
        "random",
        "random-current",
      );
    });
  });

  it("treats an in-progress activation load as the initial sync", async () => {
    vi.useFakeTimers();
    testState.rootStore.feedStore.isLoading = true;
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(0);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).not.toHaveBeenCalled();

    testState.rootStore.feedStore.isLoading = false;
    element.requestUpdate();
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("removes the manual refresh button and preserves visible posts during lifecycle sync", async () => {
    testState.rootStore.feedStore.items = [
      {
        atUri: "at://visible",
        postUrl: null,
        finalPosition: 1,
        author: "@author.test",
        displayName: "Author",
        avatarUrl: null,
        createdAt: "",
        content: "Visible post",
        mediaLabels: [],
        imageUrls: [],
        videoUrl: null,
        linkCard: null,
        generators: [],
        rankPosition: null,
        rankScore: null,
        afterRankPosition: null,
        modelScores: [],
        diversification: null,
        replyCount: 0,
        repostCount: 0,
        likeCount: 0,
      },
    ];
    testState.rootStore.feedStore.currentRequestId = "random-old";
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;

    await vi.waitFor(() => {
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledWith(
        "random",
        null,
      );
      expect(element.shadowRoot?.querySelector("feed-view")).not.toBeNull();
    });
    expect(
      element.shadowRoot?.querySelector('button[aria-label="Refresh feed history"]'),
    ).toBeNull();
    expect(element.shadowRoot?.querySelector(".refresh-status")).toBeNull();
  });

  it("coalesces lifecycle events and never starts periodic polling", async () => {
    vi.useFakeTimers();
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      const element = document.createElement("feed-page");
      document.body.appendChild(element);
      await element.updateComplete;
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(3);
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      vi.useRealTimers();
    }
  });

  it("queues one trailing lifecycle sync while another sync is running", async () => {
    vi.useFakeTimers();
    let finishFirst: ((value: boolean) => void) | undefined;
    testState.rootStore.feedStore.refreshFeedIfNew.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(0);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
    await vi.advanceTimersByTimeAsync(0);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(1);

    finishFirst?.(false);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("synchronizes again when the selected feed or account changes", async () => {
    testState.rootStore.feedStore.feedList = [
      {
        requestId: "random-current",
        generatedAt: "2026-08-24T12:00:00Z",
        feedName: "random",
      },
      {
        requestId: "mysky-current",
        generatedAt: "2026-08-25T12:00:00Z",
        feedName: "your-feed",
      },
    ];
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await vi.waitFor(() => {
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledWith(
        "random",
        "random-current",
      );
    });

    testState.rootStore.feedStore.refreshFeedIfNew.mockClear();
    testState.rootStore.uiStore.selectedAlgorithm = "your-feed";
    element.requestUpdate();
    await element.updateComplete;
    await vi.waitFor(() => {
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledWith(
        "your-feed",
        "mysky-current",
      );
    });

    testState.rootStore.feedStore.refreshFeedIfNew.mockClear();
    testState.rootStore.accountStore.activeAccount.did = "did:plc:other";
    element.requestUpdate();
    await element.updateComplete;
    await vi.waitFor(() => {
      expect(testState.rootStore.feedStore.refreshFeedIfNew).toHaveBeenCalledWith(
        "your-feed",
        "mysky-current",
      );
    });
  });
});

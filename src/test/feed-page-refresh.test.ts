import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  loadFeedList: vi.fn(),
  rootStore: {
    authStore: { isSignedIn: true },
    accountStore: { activeAccount: { did: "did:plc:test" } },
    feedStore: {
      isLoading: false,
      feedList: [],
      currentRequestId: null,
      filteringCountsByRequest: {},
      error: null,
      items: [],
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
      postsPerPage: 10,
      loadFeedList: vi.fn(),
      loadFeedDetail: vi.fn(),
      goToPage: vi.fn(),
      setPostsPerPage: vi.fn(),
    },
    uiStore: {
      selectedAlgorithm: "random" as const,
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
    testState.rootStore.uiStore.selectedAlgorithm = "random";
    testState.rootStore.feedStore.loadFeedList.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("refreshes the feed selected by the current route after a downward pull", async () => {
    let finishRefresh: (() => void) | undefined;
    testState.rootStore.feedStore.loadFeedList.mockImplementation(
      () => new Promise<void>((resolve) => {
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
      expect(
        element.shadowRoot?.querySelector<HTMLElement>(".pull-refresh")?.style.height,
      ).toBe("0px");
    });
  });
});

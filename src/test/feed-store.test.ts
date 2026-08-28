import { describe, expect, it, vi } from "vitest";
import type { ApiFeedItem, FeedListResponse } from "../models/feed-debug-snapshot";
import type { RootStore } from "../stores/root-store";
import { FeedStore } from "../stores/feed-store";

function makeStore(
  listFeeds: () => Promise<FeedListResponse>,
  uiStore: {
    setSelectedAlgorithm: ReturnType<typeof vi.fn>;
    clearSelectedAlgorithm?: ReturnType<typeof vi.fn>;
    selectedAlgorithm?: string | null;
  } = { setSelectedAlgorithm: vi.fn(), selectedAlgorithm: null },
) {
  const root = {
    services: {
      feedApiService: {
        listFeeds,
        getFeedDetail: vi.fn().mockResolvedValue({
          requestId: "r1",
          generatedAt: "2026-07-28T00:00:00Z",
          items: [],
          filteringCounts: {
            storedItemCount: 0,
            displayedItemCount: 0,
            publiclyFilteredCount: 0,
            unavailableCount: 0,
          },
        }),
      },
    },
    uiStore,
  } as unknown as RootStore;
  return new FeedStore(root);
}

function makeFeedItem(index: number): ApiFeedItem {
  return {
    atUri: `at://did:plc:test/post/${String(index)}`,
    rank: index,
    rankScore: null,
    afterRankPosition: null,
    author: { handle: "alice.test", displayName: "Alice", avatarUrl: null },
    createdAt: "2026-08-16T00:00:00Z",
    content: `Post ${String(index)}`,
    generators: [],
    modelScores: [],
    diversification: null,
    media: null,
    engagement: null,
    postUrl: null,
  };
}

describe("FeedStore pagination", () => {
  it("defaults and resets to 20 posts and returns to page one after a size change", async () => {
    const store = makeStore(vi.fn().mockResolvedValue({ feeds: [] }));
    const api = (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
      }
    ).root.services.feedApiService;
    api.getFeedDetail.mockResolvedValue({
      requestId: "r1",
      generatedAt: "2026-08-16T00:00:00Z",
      apiReleaseSha: null,
      items: Array.from({ length: 45 }, (_, index) => makeFeedItem(index + 1)),
      filteringCounts: {
        storedItemCount: 45,
        displayedItemCount: 45,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
    });

    await store.loadFeedDetail("r1");
    expect(store.postsPerPage).toBe(20);
    expect(store.items).toHaveLength(20);
    expect(store.totalPages).toBe(3);

    store.goToPage(2);
    expect(store.currentPage).toBe(2);
    expect(store.items[0]?.finalPosition).toBe(21);
    store.setPostsPerPage(50);
    expect(store.currentPage).toBe(1);
    expect(store.items).toHaveLength(45);

    store.reset();
    expect(store.postsPerPage).toBe(20);
    expect(store.currentPage).toBe(1);
  });
});

describe("FeedStore.loadFeedList", () => {
  it("records a successful empty response as loaded", async () => {
    const listFeeds = vi.fn().mockResolvedValue({ feeds: [] });
    const store = makeStore(listFeeds);

    await store.loadFeedList();

    expect(listFeeds).toHaveBeenCalledOnce();
    expect(store.feedList).toEqual([]);
    expect(store.feedListLoadState).toBe("loaded");
    expect(store.isLoading).toBe(false);
  });

  it("records a failed request without leaving the list idle", async () => {
    const store = makeStore(vi.fn().mockRejectedValue(new Error("offline")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await store.loadFeedList();

    expect(store.feedListLoadState).toBe("error");
    expect(store.error).toBe("offline");
    expect(store.isLoading).toBe(false);
    consoleError.mockRestore();
  });

  it("ignores a response that finishes after the store is reset", async () => {
    let resolveRequest: ((response: FeedListResponse) => void) | undefined;
    const request = new Promise<FeedListResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const store = makeStore(vi.fn().mockReturnValue(request));

    const load = store.loadFeedList();
    store.reset();
    resolveRequest?.({
      feeds: [
        {
          requestId: "old-account-request",
          generatedAt: "2026-07-28T00:00:00Z",
          feedName: "your-feed",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    await load;

    expect(store.feedList).toEqual([]);
    expect(store.feedListLoadState).toBe("idle");
    expect(store.isLoading).toBe(false);
  });

  it("quietly loads detail only when Bluesky creates a new snapshot", async () => {
    const listFeeds = vi.fn().mockResolvedValue({
      feeds: [
        {
          requestId: "new-request",
          generatedAt: "2026-08-10T12:00:00Z",
          feedName: "random",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    const store = makeStore(listFeeds, {
      setSelectedAlgorithm: vi.fn(),
      selectedAlgorithm: "random",
    });
    const api = (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
      }
    ).root.services.feedApiService;

    expect(await store.refreshFeedIfNew("random", "old-request")).toBe(true);
    expect(api.getFeedDetail).toHaveBeenCalledWith("new-request");
    expect(store.isLoading).toBe(false);
    api.getFeedDetail.mockClear();

    expect(await store.refreshFeedIfNew("random", "new-request")).toBe(false);
    expect(api.getFeedDetail).not.toHaveBeenCalled();
  });

  it("keeps the current screen stable while a returned Bluesky snapshot downloads", async () => {
    let resolveDetail:
      | ((value: {
          requestId: string;
          generatedAt: string;
          items: [];
          filteringCounts: {
            storedItemCount: number;
            displayedItemCount: number;
            publiclyFilteredCount: number;
            unavailableCount: number;
          };
        }) => void)
      | undefined;
    const detailRequest = new Promise<{
      requestId: string;
      generatedAt: string;
      items: [];
      filteringCounts: {
        storedItemCount: number;
        displayedItemCount: number;
        publiclyFilteredCount: number;
        unavailableCount: number;
      };
    }>((resolve) => {
      resolveDetail = resolve;
    });
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "new-request",
            generatedAt: "2026-08-10T12:00:00Z",
            feedName: "random",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm: vi.fn(), selectedAlgorithm: "random" },
    );
    const api = (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
      }
    ).root.services.feedApiService;
    api.getFeedDetail.mockReturnValue(detailRequest);
    store.currentRequestId = "old-request";

    const refresh = store.refreshFeedIfNew("random", "old-request");
    await vi.waitFor(() => {
      expect(api.getFeedDetail).toHaveBeenCalledWith("new-request");
    });
    expect(store.isLoading).toBe(false);
    expect(store.currentRequestId).toBe("old-request");

    resolveDetail?.({
      requestId: "new-request",
      generatedAt: "2026-08-10T12:00:00Z",
      items: [],
      filteringCounts: {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
    });
    expect(await refresh).toBe(true);
    expect(store.currentRequestId).toBe("new-request");
  });

  it("replaces an older populated snapshot with a newer real empty snapshot", async () => {
    const listFeeds = vi.fn().mockResolvedValue({
      feeds: [
        {
          requestId: "empty-new",
          generatedAt: "2026-08-10T13:00:00Z",
          feedName: "random",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [
            {
              name: "random_posts",
              weight: 1,
              requestedCount: 30,
              returnedCount: 0,
              contributedCount: 0,
              status: "empty",
              reason: "source_returned_no_candidates",
              mode: "primary",
            },
          ],
        },
      ],
    });
    const store = makeStore(listFeeds, {
      setSelectedAlgorithm: vi.fn(),
      selectedAlgorithm: "random",
    });
    const api = (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
      }
    ).root.services.feedApiService;
    api.getFeedDetail.mockResolvedValueOnce({
      requestId: "populated-old",
      generatedAt: "2026-08-10T12:00:00Z",
      apiReleaseSha: null,
      items: [makeFeedItem(1)],
      filteringCounts: {
        storedItemCount: 1,
        displayedItemCount: 1,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
      generatorDiagnostics: [],
    });
    await store.loadFeedDetail("populated-old");
    expect(store.items).toHaveLength(1);
    api.getFeedDetail.mockResolvedValueOnce({
      requestId: "empty-new",
      generatedAt: "2026-08-10T13:00:00Z",
      apiReleaseSha: null,
      items: [],
      filteringCounts: {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
      generatorDiagnostics: [],
    });

    await store.loadFeedList({ feedName: "random", force: true });

    expect(store.currentRequestId).toBe("empty-new");
    expect(store.items).toEqual([]);
    expect(store.totalCount).toBe(0);
    expect(store.currentGeneratorDiagnostics[0]?.reason).toBe("source_returned_no_candidates");
  });
});

describe("FeedStore.loadFeedList – selectedAlgorithm", () => {
  it("defaults to GreenEarth even when another feed has the only activity", async () => {
    const getFeedDetail = vi.fn().mockResolvedValue({
      requestId: "r1",
      generatedAt: "2026-07-28T12:00:00Z",
      items: [],
      filteringCounts: {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
    });
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "r1",
            generatedAt: "2026-07-28T12:00:00Z",
            feedName: "best-of-friends",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm, selectedAlgorithm: null },
    );
    (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: typeof getFeedDetail } } };
      }
    ).root.services.feedApiService.getFeedDetail = getFeedDetail;

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(getFeedDetail).not.toHaveBeenCalled();
  });

  it("force-refreshes the newest snapshot for the requested feed", async () => {
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "friends-new",
            generatedAt: "2026-08-07T12:00:00Z",
            feedName: "best-of-friends",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
          {
            requestId: "random-new",
            generatedAt: "2026-08-07T11:00:00Z",
            feedName: "random",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm, selectedAlgorithm: "random" },
    );

    await store.loadFeedList({ feedName: "random", force: true });

    expect(
      (
        store as unknown as {
          root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
        }
      ).root.services.feedApiService.getFeedDetail,
    ).toHaveBeenCalledWith("random-new");
    expect(setSelectedAlgorithm).not.toHaveBeenCalled();
  });

  it("does not populate a refreshed feed after navigation changes", async () => {
    let resolveList: ((response: FeedListResponse) => void) | undefined;
    const listRequest = new Promise<FeedListResponse>((resolve) => {
      resolveList = resolve;
    });
    const uiStore = { setSelectedAlgorithm: vi.fn(), selectedAlgorithm: "random" };
    const store = makeStore(vi.fn().mockReturnValue(listRequest), uiStore);

    const refresh = store.loadFeedList({ feedName: "random", force: true });
    uiStore.selectedAlgorithm = "best-of-friends";
    resolveList?.({
      feeds: [
        {
          requestId: "random-new",
          generatedAt: "2026-08-07T11:00:00Z",
          feedName: "random",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    await refresh;

    expect(
      (
        store as unknown as {
          root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
        }
      ).root.services.feedApiService.getFeedDetail,
    ).not.toHaveBeenCalled();
    expect(store.feedList).toHaveLength(1);
  });

  it("selects GreenEarth when the feed list is empty", async () => {
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(vi.fn().mockResolvedValue({ feeds: [] }), {
      setSelectedAlgorithm,
      selectedAlgorithm: null,
    });

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(store.currentRequestId).toBeNull();
  });

  it("loads GreenEarth rather than the newest snapshot from another feed", async () => {
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "r1",
            generatedAt: "2026-07-28T02:00:00Z",
            feedName: "best-of-friends",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
          {
            requestId: "r2",
            generatedAt: "2026-07-28T01:00:00Z",
            feedName: "your-feed",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm, selectedAlgorithm: null },
    );

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(
      (
        store as unknown as {
          root: { services: { feedApiService: { getFeedDetail: ReturnType<typeof vi.fn> } } };
        }
      ).root.services.feedApiService.getFeedDetail,
    ).toHaveBeenCalledWith("r2");
  });

  it("does not change selectedAlgorithm when already set", async () => {
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "r1",
            generatedAt: "2026-07-28T00:00:00Z",
            feedName: "your-feed",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm, selectedAlgorithm: "random" },
    );

    await store.loadFeedList();

    expect(setSelectedAlgorithm).not.toHaveBeenCalled();
  });

  it("skips non-public feeds and loads the most recent public one", async () => {
    const getFeedDetail = vi.fn().mockResolvedValue({
      requestId: "r1",
      generatedAt: "2026-07-28T12:00:00Z",
      items: [],
      filteringCounts: {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
    });
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(
      vi.fn().mockResolvedValue({
        feeds: [
          {
            requestId: "r0",
            generatedAt: "2026-07-28T13:00:00Z",
            feedName: "cutoff-preview",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
          {
            requestId: "r1",
            generatedAt: "2026-07-28T12:00:00Z",
            feedName: "your-feed",
            apiReleaseSha: null,
            appliedSocialRadius: null,
            generatorDiagnostics: [],
          },
        ],
      }),
      { setSelectedAlgorithm, selectedAlgorithm: null },
    );
    (
      store as unknown as {
        root: { services: { feedApiService: { getFeedDetail: typeof getFeedDetail } } };
      }
    ).root.services.feedApiService.getFeedDetail = getFeedDetail;

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(getFeedDetail).toHaveBeenCalledWith("r1");
    expect(getFeedDetail).toHaveBeenCalledTimes(1);
  });
});

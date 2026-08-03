import { describe, expect, it, vi } from "vitest";
import type { FeedListResponse } from "../models/feed-debug-snapshot";
import type { RootStore } from "../stores/root-store";
import { FeedStore } from "../stores/feed-store";

function makeStore(
  listFeeds: () => Promise<FeedListResponse>,
  uiStore: { setSelectedAlgorithm: ReturnType<typeof vi.fn>; clearSelectedAlgorithm?: ReturnType<typeof vi.fn>; selectedAlgorithm?: string | null } = { setSelectedAlgorithm: vi.fn(), selectedAlgorithm: null },
) {
  const root = {
    services: {
      feedApiService: {
        listFeeds,
        getFeedDetail: vi.fn().mockResolvedValue({
          requestId: "r1",
          generatedAt: "2026-07-28T00:00:00Z",
          items: [],
          filteringCounts: { storedItemCount: 0, displayedItemCount: 0, publiclyFilteredCount: 0, unavailableCount: 0 },
        }),
      },
    },
    uiStore,
  } as unknown as RootStore;
  return new FeedStore(root);
}

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
});

describe("FeedStore.loadFeedList – selectedAlgorithm", () => {
  it("sets selectedAlgorithm and loads the most recent public feed on first load", async () => {
    const getFeedDetail = vi.fn().mockResolvedValue({
      requestId: "r1",
      generatedAt: "2026-07-28T12:00:00Z",
      items: [],
      filteringCounts: { storedItemCount: 0, displayedItemCount: 0, publiclyFilteredCount: 0, unavailableCount: 0 },
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
    (store as unknown as { root: { services: { feedApiService: { getFeedDetail: typeof getFeedDetail } } } })
      .root.services.feedApiService.getFeedDetail = getFeedDetail;

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("best-of-friends");
    expect(getFeedDetail).toHaveBeenCalledWith("r1");
  });

  it("does not call setSelectedAlgorithm when feed list is empty", async () => {
    const setSelectedAlgorithm = vi.fn();
    const store = makeStore(vi.fn().mockResolvedValue({ feeds: [] }), { setSelectedAlgorithm, selectedAlgorithm: null });

    await store.loadFeedList();

    expect(setSelectedAlgorithm).not.toHaveBeenCalled();
  });

  it("sets selectedAlgorithm from the most-recent snapshot on first load", async () => {
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

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("best-of-friends");
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
      filteringCounts: { storedItemCount: 0, displayedItemCount: 0, publiclyFilteredCount: 0, unavailableCount: 0 },
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
    (store as unknown as { root: { services: { feedApiService: { getFeedDetail: typeof getFeedDetail } } } })
      .root.services.feedApiService.getFeedDetail = getFeedDetail;

    await store.loadFeedList();

    expect(setSelectedAlgorithm).toHaveBeenCalledWith("your-feed");
    expect(getFeedDetail).toHaveBeenCalledWith("r1");
    expect(getFeedDetail).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { FeedListResponse } from "../models/feed-debug-snapshot";
import type { RootStore } from "../stores/root-store";
import { FeedStore } from "../stores/feed-store";

function makeStore(listFeeds: () => Promise<FeedListResponse>) {
  const root = {
    services: {
      feedApiService: {
        listFeeds,
        getFeedDetail: vi.fn(),
      },
    },
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

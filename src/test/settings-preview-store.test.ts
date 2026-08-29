import { describe, expect, it, vi } from "vitest";
import type { ApiFeedItem, FeedDetailResponse } from "../models/feed-debug-snapshot";
import { FeedApiError, type FeedPreferences } from "../services/types";
import type { RootStore } from "../stores/root-store";
import { SettingsPreviewStore } from "../stores/settings-preview-store";

function apiItem(atUri: string): ApiFeedItem {
  return {
    atUri,
    rank: 1,
    rankScore: 0.8,
    afterRankPosition: 1,
    author: { handle: "author.test", displayName: "Author", avatarUrl: null },
    createdAt: "2026-08-23T12:00:00Z",
    content: atUri,
    generators: [{ name: "followed_users", score: 0.8 }],
    modelScores: [],
    diversification: null,
    media: null,
    engagement: null,
    postUrl: null,
  };
}

function detail(
  requestId: string,
  uris: string[],
  generatedAt = new Date().toISOString(),
): FeedDetailResponse {
  return {
    requestId,
    generatedAt,
    apiReleaseSha: null,
    items: uris.map(apiItem),
    filteringCounts: {
      storedItemCount: uris.length,
      displayedItemCount: uris.length,
      publiclyFilteredCount: 0,
      unavailableCount: 0,
      partialItemCount: 0,
    },
    generatorDiagnostics: [],
  };
}

function harness(generatedAt = new Date().toISOString()) {
  const createFeedPreview = vi.fn().mockResolvedValue({
    requestId: "preview-1",
    feedName: "your-feed",
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  const getFeedPreview = vi.fn().mockResolvedValue(detail("preview-1", ["b", "a", "new"]));
  const acceptFeedPreview = vi.fn().mockResolvedValue({
    requestId: "preview-1",
    preferences: {},
    acceptedUntil: null,
  });
  const listFeeds = vi.fn().mockResolvedValue({
    feeds: [
      {
        requestId: "baseline-1",
        generatedAt,
        feedName: "your-feed",
        apiReleaseSha: null,
        appliedSocialRadius: null,
        generatorDiagnostics: [],
      },
    ],
  });
  const getFeedDetail = vi.fn().mockResolvedValue(detail("baseline-1", ["a", "b", "c"]));
  const root = {
    services: {
      feedApiService: {
        listFeeds,
        getFeedDetail,
        createFeedPreview,
        getFeedPreview,
        acceptFeedPreview,
      },
    },
  } as unknown as RootStore;
  return {
    root,
    acceptFeedPreview,
    createFeedPreview,
    getFeedDetail,
    getFeedPreview,
    listFeeds,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe("SettingsPreviewStore", () => {
  it("loads a fresh served slate as the neutral baseline", async () => {
    const { root, getFeedDetail } = harness();
    const store = new SettingsPreviewStore(root);

    await store.activateFeed("your-feed");

    expect(getFeedDetail).toHaveBeenCalledWith("baseline-1");
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.isDisplayingBaseline).toBe(true);
  });

  it("accepts the exact hydrated Preview before making it displayable", async () => {
    const { root, acceptFeedPreview, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const patch: FeedPreferences = {
      sourceWeights: {
        following: 0.4,
        networkLikes: 0.2,
        authorsTopics: 0.2,
        popular: 0.2,
      },
      freshness: 2,
      purpose: 0.65,
    };

    const preview = await store.preview(patch);
    const accepted = preview ? await store.acceptGeneratedPreview(preview, patch) : null;

    expect(createFeedPreview).toHaveBeenCalledWith("your-feed", patch);
    expect(preview?.items.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(acceptFeedPreview).toHaveBeenCalledWith("your-feed", "preview-1", patch, [
      "b",
      "a",
      "new",
    ]);
    if (accepted) store.acceptPreview(accepted);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.isDisplayingBaseline).toBe(false);
  });

  it("regenerates and accepts once when the Preview cache expires", async () => {
    const { root, acceptFeedPreview, createFeedPreview, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const patch = { freshness: 2 };
    createFeedPreview
      .mockResolvedValueOnce({
        requestId: "preview-1",
        feedName: "your-feed",
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      })
      .mockResolvedValueOnce({
        requestId: "preview-2",
        feedName: "your-feed",
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    getFeedPreview
      .mockResolvedValueOnce(detail("preview-1", ["old-preview"]))
      .mockResolvedValueOnce(detail("preview-2", ["replacement"]));
    acceptFeedPreview
      .mockRejectedValueOnce(new FeedApiError(404, "Feed preview not found"))
      .mockResolvedValueOnce({ requestId: "preview-2", preferences: patch, acceptedUntil: null });

    const preview = await store.preview(patch);
    const accepted = preview ? await store.acceptGeneratedPreview(preview, patch) : null;

    expect(createFeedPreview).toHaveBeenCalledTimes(2);
    expect(acceptFeedPreview).toHaveBeenNthCalledWith(1, "your-feed", "preview-1", patch, [
      "old-preview",
    ]);
    expect(acceptFeedPreview).toHaveBeenNthCalledWith(2, "your-feed", "preview-2", patch, [
      "replacement",
    ]);
    expect(accepted?.requestId).toBe("preview-2");
  });

  it("exposes a stale-preference conflict only as an internal recovery signal", async () => {
    const { root, acceptFeedPreview, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    acceptFeedPreview.mockRejectedValueOnce(
      new FeedApiError(409, "Settings changed after this preview was generated"),
    );
    const patch = { freshness: 2 };

    const preview = await store.preview(patch);
    const accepted = preview ? await store.acceptGeneratedPreview(preview, patch) : null;

    expect(accepted).toBeNull();
    expect(createFeedPreview).toHaveBeenCalledTimes(1);
    expect(acceptFeedPreview).toHaveBeenCalledTimes(1);
    expect(store.acceptanceConflict).toBe(true);
    expect(store.error).toBeNull();
    expect(JSON.stringify(store)).not.toContain("Settings changed before Preview");

    store.markPreviewSyncFailure();
    expect(store.acceptanceConflict).toBe(false);
    expect(store.error).toBe("Preview could not be synchronized with MySky. Try again.");
    expect(store.error).not.toContain("Settings changed");
  });

  it("keeps the current posts visible when preview generation fails", async () => {
    const { root, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    createFeedPreview.mockRejectedValueOnce(new Error("preview unavailable"));

    await expect(store.preview({ freshness: 2 })).resolves.toBeNull();

    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.error).toBe("preview unavailable");
  });

  it("retries the same preview snapshot when hydration is partial", async () => {
    vi.useFakeTimers();
    try {
      const { root, getFeedPreview } = harness();
      const store = new SettingsPreviewStore(root);
      await store.activateFeed("your-feed");
      const partial = detail("preview-1", ["ranked"]);
      partial.items = [{ ...apiItem("ranked"), isPartial: true }];
      partial.filteringCounts.partialItemCount = 1;
      partial.filteringCounts.unavailableCount = 1;
      const hydrated = detail("preview-1", ["ranked"]);
      getFeedPreview.mockReset().mockResolvedValueOnce(partial).mockResolvedValueOnce(hydrated);

      const pending = store.preview({ freshness: 2 });
      await vi.advanceTimersByTimeAsync(300);
      const preview = await pending;

      expect(getFeedPreview).toHaveBeenNthCalledWith(1, "preview-1");
      expect(getFeedPreview).toHaveBeenNthCalledWith(2, "preview-1");
      expect(preview?.items[0]?.isPartial).toBe(false);
      expect(preview?.filteringCounts.partialItemCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles Preview hydration across multiple improving responses", async () => {
    vi.useFakeTimers();
    try {
      const { root, acceptFeedPreview, getFeedPreview } = harness();
      const store = new SettingsPreviewStore(root);
      await store.activateFeed("your-feed");
      const initial = detail("preview-1", ["one"]);
      initial.items = [{ ...apiItem("one"), isPartial: true }];
      initial.filteringCounts = {
        ...initial.filteringCounts,
        storedItemCount: 2,
        unavailableCount: 1,
        partialItemCount: 1,
      };
      const improving = detail("preview-1", ["one", "two"]);
      if (!improving.items) throw new Error("Expected improving Preview items");
      improving.items[1] = { ...apiItem("two"), isPartial: true };
      improving.filteringCounts = {
        ...improving.filteringCounts,
        storedItemCount: 2,
        unavailableCount: 1,
        partialItemCount: 1,
      };
      const hydrated = detail("preview-1", ["one", "two"]);
      getFeedPreview
        .mockReset()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(improving)
        .mockResolvedValueOnce(hydrated);

      const pending = store.preview({ freshness: 2 });
      await vi.advanceTimersByTimeAsync(1_000);
      const preview = await pending;
      const patch = { freshness: 2 };
      const accepted = preview ? await store.acceptGeneratedPreview(preview, patch) : null;

      expect(getFeedPreview).toHaveBeenCalledTimes(3);
      expect(preview?.items.map((item) => item.atUri)).toEqual(["one", "two"]);
      expect(preview?.items.every((item) => !item.isPartial)).toBe(true);
      expect(preview?.filteringCounts.partialItemCount).toBe(0);
      expect(acceptFeedPreview).toHaveBeenCalledWith("your-feed", "preview-1", patch, [
        "one",
        "two",
      ]);
      expect(accepted?.items.map((item) => item.atUri)).toEqual(["one", "two"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows ranked fallback cards after the hydration retry remains partial", async () => {
    vi.useFakeTimers();
    try {
      const { root, getFeedPreview } = harness();
      const store = new SettingsPreviewStore(root);
      await store.activateFeed("your-feed");
      const partial = detail("preview-1", ["ranked"]);
      partial.items = [{ ...apiItem("ranked"), isPartial: true }];
      partial.filteringCounts.partialItemCount = 1;
      partial.filteringCounts.unavailableCount = 1;
      getFeedPreview.mockReset().mockResolvedValue(partial);

      const pending = store.preview({ freshness: 2 });
      await vi.advanceTimersByTimeAsync(2_500);
      const preview = await pending;
      expect(preview).not.toBeNull();
      if (preview) store.acceptPreview(preview);

      expect(store.displayedItems[0]?.isPartial).toBe(true);
      expect(store.warning).toContain("1 ranked post is shown with limited details");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the current slate when every active generator fails", async () => {
    const { root, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const failed = detail("preview-1", []);
    failed.generatorDiagnostics = [
      {
        name: "network_likes",
        weight: 1,
        requestedCount: 100,
        returnedCount: 0,
        contributedCount: 0,
        status: "timeout",
        reason: "generator_timeout",
        mode: "primary",
      },
    ];
    getFeedPreview.mockReset().mockResolvedValue(failed);

    await expect(store.preview({ freshness: 2 })).resolves.toBeNull();

    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.error).toContain("Liked by Following");
  });

  it("accepts a truthful empty source and explains it", async () => {
    const { root, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const empty = detail("preview-1", []);
    empty.generatorDiagnostics = [
      {
        name: "followed_users",
        weight: 1,
        requestedCount: 100,
        returnedCount: 0,
        contributedCount: 0,
        status: "empty",
        reason: "no_candidates",
        mode: "primary",
      },
    ];
    getFeedPreview.mockReset().mockResolvedValue(empty);

    const preview = await store.preview({ freshness: 2 });
    expect(preview).not.toBeNull();
    if (preview) store.acceptPreview(preview);

    expect(store.displayedItems).toEqual([]);
    expect(store.warning).toContain("Following returned no candidates");
  });

  it("explains when feed history exhausted the selected source", async () => {
    const { root, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const empty = detail("preview-1", []);
    empty.generatorDiagnostics = [
      {
        name: "followed_users",
        weight: 1,
        requestedCount: 100,
        returnedCount: 0,
        contributedCount: 0,
        status: "empty",
        reason: "history_exclusions",
        mode: "primary",
      },
    ];
    getFeedPreview.mockReset().mockResolvedValue(empty);

    const preview = await store.preview({ freshness: 2 });
    expect(preview).not.toBeNull();
    if (preview) store.acceptPreview(preview);

    expect(store.warning).toContain("Following only found posts already excluded by feed history");
  });

  it("uses an empty hypothetical request to replace an old baseline", async () => {
    const { root, createFeedPreview, getFeedPreview } = harness(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    const store = new SettingsPreviewStore(root);

    await store.activateFeed("your-feed");

    expect(createFeedPreview).toHaveBeenCalledWith("your-feed", {});
    expect(getFeedPreview).toHaveBeenCalledWith("preview-1");
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
  });

  it("adopts a newer served slate and resets the displayed comparison", async () => {
    const baselineGeneratedAt = new Date(Date.now() - 60_000).toISOString();
    const newerGeneratedAt = new Date().toISOString();
    const { root, listFeeds, getFeedDetail } = harness(baselineGeneratedAt);
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    listFeeds.mockResolvedValueOnce({
      feeds: [
        {
          requestId: "served-2",
          generatedAt: newerGeneratedAt,
          feedName: "your-feed",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    getFeedDetail.mockResolvedValueOnce(detail("served-2", ["new-a", "new-b"], newerGeneratedAt));

    await expect(store.refreshBaselineIfNew("your-feed")).resolves.toEqual({
      status: "updated",
    });
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["new-a", "new-b"]);
    expect(store.isDisplayingBaseline).toBe(true);
  });

  it("retains the current baseline and exposes refresh errors for retry", async () => {
    const { root, listFeeds } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    listFeeds.mockRejectedValueOnce(new Error("history unavailable"));

    await expect(store.refreshBaselineIfNew("your-feed")).resolves.toEqual({ status: "error" });
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.baselineRefreshError).toBe("history unavailable");
  });

  it("shares duplicate activation work for the same feed", async () => {
    const { root, listFeeds } = harness();
    const pendingList = deferred<Awaited<ReturnType<typeof listFeeds>>>();
    listFeeds.mockReturnValueOnce(pendingList.promise);
    const store = new SettingsPreviewStore(root);

    const first = store.activateFeed("your-feed");
    const second = store.activateFeed("your-feed");

    expect(listFeeds).toHaveBeenCalledTimes(1);
    pendingList.resolve({
      feeds: [
        {
          requestId: "baseline-1",
          generatedAt: new Date().toISOString(),
          feedName: "your-feed",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    await Promise.all([first, second]);
    expect(store.isLoadingBaseline).toBe(false);
  });

  it("shares duplicate baseline synchronization for the same feed", async () => {
    const { root, listFeeds } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    listFeeds.mockClear();
    const pendingList = deferred<Awaited<ReturnType<typeof listFeeds>>>();
    listFeeds.mockReturnValueOnce(pendingList.promise);

    const first = store.refreshBaselineIfNew("your-feed");
    const second = store.refreshBaselineIfNew("your-feed");

    expect(listFeeds).toHaveBeenCalledTimes(1);
    pendingList.resolve({ feeds: [] });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "unchanged" },
      { status: "unchanged" },
    ]);
    expect(store.isRefreshingBaseline).toBe(false);
  });

  it("clears stale preview state immediately when switching feeds", async () => {
    const { root, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const pendingPreview = deferred<Awaited<ReturnType<typeof createFeedPreview>>>();
    createFeedPreview.mockReturnValueOnce(pendingPreview.promise);

    const preview = store.preview({ freshness: 2 });
    expect(store.isGenerating).toBe(true);
    await store.activateFeed("random");

    expect(store.activeFeed).toBe("random");
    expect(store.isGenerating).toBe(false);
    expect(store.isLoadingBaseline).toBe(false);
    pendingPreview.resolve({
      requestId: "stale-preview",
      feedName: "your-feed",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    await expect(preview).resolves.toBeNull();
    expect(store.isGenerating).toBe(false);
  });

  it("clears stale refresh state immediately when switching feeds", async () => {
    const { root, listFeeds } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const pendingRefresh = deferred<Awaited<ReturnType<typeof listFeeds>>>();
    listFeeds.mockReturnValueOnce(pendingRefresh.promise);

    const refresh = store.refreshBaselineIfNew("your-feed");
    expect(store.isRefreshingBaseline).toBe(true);
    await store.activateFeed("best-of-friends");

    expect(store.activeFeed).toBe("best-of-friends");
    expect(store.isRefreshingBaseline).toBe(false);
    expect(store.isLoadingBaseline).toBe(false);
    pendingRefresh.resolve({ feeds: [] });
    await expect(refresh).resolves.toEqual({ status: "deferred" });
    expect(store.isRefreshingBaseline).toBe(false);
  });

  it("allows preview during baseline loading and ignores a late baseline display", async () => {
    const { root, listFeeds } = harness();
    const pendingBaseline = deferred<Awaited<ReturnType<typeof listFeeds>>>();
    listFeeds.mockReturnValueOnce(pendingBaseline.promise);
    const store = new SettingsPreviewStore(root);

    const activation = store.activateFeed("your-feed");
    expect(store.isLoadingBaseline).toBe(true);
    const preview = await store.preview({ freshness: 2 });
    expect(preview).not.toBeNull();
    if (preview) store.acceptPreview(preview);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);

    pendingBaseline.resolve({
      feeds: [
        {
          requestId: "baseline-1",
          generatedAt: new Date().toISOString(),
          feedName: "your-feed",
          apiReleaseSha: null,
          appliedSocialRadius: null,
          generatorDiagnostics: [],
        },
      ],
    });
    await activation;

    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.isLoadingBaseline).toBe(false);
  });

  it("does not accept a generated slate after its feed generation changes", async () => {
    const { root, acceptFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    const patch = { freshness: 2 };
    const preview = await store.preview(patch);
    expect(preview).not.toBeNull();

    await store.activateFeed("random");
    const randomItems = store.displayedItems.map((item) => item.atUri);
    const accepted = preview ? await store.acceptGeneratedPreview(preview, patch) : null;
    if (accepted) store.acceptPreview(accepted);

    expect(accepted).toBeNull();
    expect(acceptFeedPreview).not.toHaveBeenCalled();
    expect(store.activeFeed).toBe("random");
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(randomItems);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { RootStore } from "../stores/root-store";
import { SettingsPreviewStore } from "../stores/settings-preview-store";
import type { ApiFeedItem, FeedDetailResponse } from "../models/feed-debug-snapshot";
import { DEFAULT_PREFERENCES } from "../stores/preferences-store";
import { FeedApiError, type FeedPreferences, type Preferences } from "../services/types";
import type { AlgorithmId } from "../constants/algorithms";

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
    },
  };
}

function harness(generatedAt = new Date().toISOString()) {
  let savedPreferences: Preferences = {
    ...DEFAULT_PREFERENCES,
    sourceWeights: { ...DEFAULT_PREFERENCES.sourceWeights },
  };
  const applyAcceptedPatch = vi.fn(
    (_feedName: AlgorithmId, patch: FeedPreferences, saved: FeedPreferences) => {
      savedPreferences = {
        ...savedPreferences,
        ...patch,
        ...saved,
        sourceWeights: saved.sourceWeights ?? patch.sourceWeights ?? savedPreferences.sourceWeights,
      };
    },
  );
  const createFeedPreview = vi.fn().mockResolvedValue({
    requestId: "preview-1",
    feedName: "your-feed",
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  const getFeedPreview = vi.fn().mockResolvedValue(detail("preview-1", ["b", "a", "new"]));
  const acceptFeedPreview = vi
    .fn()
    .mockImplementation((_feedName: AlgorithmId, requestId: string, prefs: FeedPreferences) =>
      Promise.resolve({
        requestId,
        preferences: prefs,
        acceptedUntil: null,
      }),
    );
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
    preferencesStore: {
      valuesFor: vi.fn(() => ({
        ...savedPreferences,
        sourceWeights: { ...savedPreferences.sourceWeights },
      })),
      applyAcceptedPatch,
    },
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
    applyAcceptedPatch,
    createFeedPreview,
    getFeedDetail,
    getFeedPreview,
    listFeeds,
  };
}

describe("SettingsPreviewStore", () => {
  it("accumulates a draft without autosaving and persists it in one atomic patch", async () => {
    const { root, acceptFeedPreview, applyAcceptedPatch, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);

    await store.activateFeed("your-feed");
    store.setControl("freshness", 2);
    store.setControl("purpose", 0.65);

    expect(acceptFeedPreview).not.toHaveBeenCalled();
    expect(store.dirtyPatch).toEqual({ freshness: 2, purpose: 0.65 });

    const preview = await store.preview();
    expect(createFeedPreview).toHaveBeenCalledWith("your-feed", {
      freshness: 2,
      purpose: 0.65,
    });
    expect(preview?.items.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    if (preview) store.acceptPreview(preview);
    expect(store.displayedFilteringCounts).toEqual({
      storedItemCount: 3,
      displayedItemCount: 3,
      publiclyFilteredCount: 0,
      unavailableCount: 0,
    });
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.isDisplayingBaseline).toBe(false);

    await expect(store.save()).resolves.toBe(true);
    expect(createFeedPreview).toHaveBeenCalledTimes(1);
    expect(acceptFeedPreview).toHaveBeenCalledTimes(1);
    expect(acceptFeedPreview).toHaveBeenCalledWith(
      "your-feed",
      "preview-1",
      { freshness: 2, purpose: 0.65 },
      ["b", "a", "new"],
    );
    expect(applyAcceptedPatch).toHaveBeenCalledWith(
      "your-feed",
      { freshness: 2, purpose: 0.65 },
      { freshness: 2, purpose: 0.65 },
      {},
    );
    expect(store.hasDirtyChanges).toBe(false);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.baselineFilteringCounts).toEqual(store.displayedFilteringCounts);
    expect(store.isDisplayingBaseline).toBe(true);
    expect(store.lastPreviewSignature).toBeNull();
  });

  it("generates a matching slate before a direct save and promotes it without exposing it early", async () => {
    const { root, acceptFeedPreview, createFeedPreview, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    store.setControl("freshness", 2);

    let resolveSession:
      ((value: Awaited<ReturnType<typeof createFeedPreview>>) => void) | undefined;
    createFeedPreview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const saving = store.save();

    expect(store.isSaving).toBe(true);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(acceptFeedPreview).not.toHaveBeenCalled();

    resolveSession?.({
      requestId: "preview-1",
      feedName: "your-feed",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    await expect(saving).resolves.toBe(true);

    expect(createFeedPreview).toHaveBeenCalledWith("your-feed", { freshness: 2 });
    expect(getFeedPreview).toHaveBeenCalledWith("preview-1");
    expect(createFeedPreview.mock.invocationCallOrder[0]).toBeLessThan(
      acceptFeedPreview.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
    expect(store.hasDirtyChanges).toBe(false);
    expect(store.isSaving).toBe(false);
  });

  it("does not persist or replace the baseline when direct-save generation fails", async () => {
    const { root, acceptFeedPreview, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    store.setControl("freshness", 2);
    createFeedPreview.mockRejectedValueOnce(new Error("generation unavailable"));

    await expect(store.save()).resolves.toBe(false);

    expect(acceptFeedPreview).not.toHaveBeenCalled();
    expect(store.hasDirtyChanges).toBe(true);
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.error).toContain("have not been saved");
    expect(store.isSaving).toBe(false);
  });

  it("does not promote a generated slate when preview acceptance fails", async () => {
    const { root, acceptFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    store.setControl("freshness", 2);
    acceptFeedPreview.mockRejectedValueOnce(new Error("acceptance unavailable"));

    await expect(store.save()).resolves.toBe(false);

    expect(store.hasDirtyChanges).toBe(true);
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.error).toContain("draft is still here");
  });

  it("regenerates once when a matching preview expires before acceptance", async () => {
    const { root, acceptFeedPreview, createFeedPreview, getFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    store.setControl("freshness", 2);
    const preview = await store.preview();
    expect(preview).not.toBeNull();
    if (preview) store.acceptPreview(preview);

    acceptFeedPreview
      .mockRejectedValueOnce(new FeedApiError(409, "Preview changed"))
      .mockResolvedValueOnce({
        requestId: "preview-2",
        preferences: { freshness: 2 },
        acceptedUntil: new Date(Date.now() + 600_000).toISOString(),
      });
    createFeedPreview.mockResolvedValueOnce({
      requestId: "preview-2",
      feedName: "your-feed",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    getFeedPreview.mockResolvedValueOnce(detail("preview-2", ["new", "b", "a"]));

    await expect(store.save()).resolves.toBe(true);

    expect(createFeedPreview).toHaveBeenCalledTimes(2);
    expect(acceptFeedPreview).toHaveBeenCalledTimes(2);
    expect(acceptFeedPreview.mock.calls[1]?.[1]).toBe("preview-2");
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["new", "b", "a"]);
  });

  it("clears only controls returned to saved values and never previews a clean draft", async () => {
    const { root, createFeedPreview } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");

    store.setControl("freshness", 2);
    store.setControl("purpose", 0.65);
    store.setControl("freshness", DEFAULT_PREFERENCES.freshness);

    expect(store.dirtyControls).toEqual(["purpose"]);
    expect(store.dirtyPatch).toEqual({ purpose: 0.65 });

    store.setControl("purpose", DEFAULT_PREFERENCES.purpose);
    expect(store.hasDirtyChanges).toBe(false);
    await expect(store.preview()).resolves.toBeNull();
    expect(createFeedPreview).not.toHaveBeenCalled();
  });

  it("reports an actual Reset Defaults change even when it restores a clean draft", async () => {
    const { root } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");

    store.setControl("freshness", 2);
    expect(
      store.resetDraftToDefaults(DEFAULT_PREFERENCES, ["source_weights", "freshness", "purpose"]),
    ).toBe(true);
    expect(store.hasDirtyChanges).toBe(false);
    expect(
      store.resetDraftToDefaults(DEFAULT_PREFERENCES, ["source_weights", "freshness", "purpose"]),
    ).toBe(false);
  });

  it("refreshes an old baseline with an empty hypothetical request", async () => {
    const { root, createFeedPreview, getFeedPreview } = harness(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    const store = new SettingsPreviewStore(root);

    await store.activateFeed("your-feed");

    expect(createFeedPreview).toHaveBeenCalledWith("your-feed", {});
    expect(getFeedPreview).toHaveBeenCalledWith("preview-1");
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["b", "a", "new"]);
  });

  it("keeps an old real slate and warns when baseline regeneration fails", async () => {
    const { root, createFeedPreview } = harness(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    createFeedPreview.mockRejectedValueOnce(new Error("generation unavailable"));
    const store = new SettingsPreviewStore(root);

    await store.activateFeed("your-feed");

    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.warning).toContain("older than 10 minutes");
  });

  it("replaces a clean baseline with a newer served Bluesky snapshot", async () => {
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
      hadDirtyChanges: false,
    });
    expect(store.baselineRequestId).toBe("served-2");
    expect(store.baselineGeneratedAt).toBe(newerGeneratedAt);
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["new-a", "new-b"]);
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["new-a", "new-b"]);
    expect(store.warning).toBeNull();
  });

  it("rebases a dirty draft and invalidates its hypothetical preview without losing controls", async () => {
    const baselineGeneratedAt = new Date(Date.now() - 60_000).toISOString();
    const newerGeneratedAt = new Date().toISOString();
    const { root, listFeeds, getFeedDetail } = harness(baselineGeneratedAt);
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    store.setControl(
      "source_weights",
      {
        following: 0.4,
        networkLikes: 0.2,
        authorsTopics: 0.2,
        popular: 0.2,
      },
      "following",
    );
    store.setControl("freshness", 2);
    const preview = await store.preview();
    expect(preview).not.toBeNull();
    if (preview) store.acceptPreview(preview);

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
    getFeedDetail.mockResolvedValueOnce(
      detail("served-2", ["fresh-1", "fresh-2"], newerGeneratedAt),
    );

    await expect(store.refreshBaselineIfNew("your-feed")).resolves.toEqual({
      status: "updated",
      hadDirtyChanges: true,
    });
    expect(store.dirtyControls).toEqual(["source_weights", "freshness"]);
    expect(store.dirtyPatch).toEqual({
      sourceWeights: {
        following: 0.4,
        networkLikes: 0.2,
        authorsTopics: 0.2,
        popular: 0.2,
      },
      freshness: 2,
    });
    expect(store.origins.source_weights).toBe("following");
    expect(store.activeControl).toBe("freshness");
    expect(store.lastPreviewRequestId).toBeNull();
    expect(store.lastPreviewSignature).toBeNull();
    expect(store.displayedItems.map((item) => item.atUri)).toEqual(["fresh-1", "fresh-2"]);
    expect(store.warning).toContain("draft is unchanged");
  });

  it("retains the current baseline and exposes refresh errors for retry", async () => {
    const { root, listFeeds } = harness();
    const store = new SettingsPreviewStore(root);
    await store.activateFeed("your-feed");
    listFeeds.mockRejectedValueOnce(new Error("history unavailable"));

    await expect(store.refreshBaselineIfNew("your-feed")).resolves.toEqual({
      status: "error",
      hadDirtyChanges: false,
    });
    expect(store.baselineItems.map((item) => item.atUri)).toEqual(["a", "b", "c"]);
    expect(store.baselineRefreshError).toBe("history unavailable");
  });
});

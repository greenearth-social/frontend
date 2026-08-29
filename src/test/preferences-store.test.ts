import { describe, expect, it, vi } from "vitest";
import type { FeedPreferences, FeedPreferencesByFeed } from "../services/types";
import type { RootStore } from "../stores/root-store";
import { PreferencesStore } from "../stores/preferences-store";
import type { AlgorithmId } from "../constants/algorithms";

const loaded: FeedPreferencesByFeed = {
  "your-feed": {
    sourceWeights: {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    },
    freshness: 5,
    purpose: 0.5,
  },
  "best-of-friends": { freshness: 3, purpose: 0.65 },
  random: { freshness: 1 },
};

function makeStore(
  patchPreferences: (feedName: AlgorithmId, values: FeedPreferences) => Promise<FeedPreferences>,
) {
  const capture = vi.fn();
  const root = {
    services: {
      feedApiService: {
        patchPreferences,
        getPreferences: vi.fn().mockResolvedValue(loaded),
      },
      analyticsService: { capture },
    },
  } as unknown as RootStore;
  return { store: new PreferencesStore(root), capture };
}

describe("PreferencesStore.load", () => {
  it("loads independent values and API-configured controls for every feed", async () => {
    const { store } = makeStore(vi.fn());

    await store.load();

    expect(store.valuesFor("your-feed")).toMatchObject({ freshness: 5, purpose: 0.5 });
    expect(store.valuesFor("best-of-friends")).toMatchObject({ freshness: 3, purpose: 0.65 });
    expect(store.valuesFor("random").freshness).toBe(1);
    expect(store.controlsByFeed["best-of-friends"]).toEqual(["freshness", "purpose"]);
    expect(store.supportsControl("random", "purpose")).toBe(false);
  });

  it("shares one in-flight load", async () => {
    let resolveLoad: ((value: FeedPreferencesByFeed) => void) | undefined;
    const getPreferences = vi.fn().mockReturnValue(
      new Promise<FeedPreferencesByFeed>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const root = {
      services: { feedApiService: { getPreferences, patchPreferences: vi.fn() } },
    } as unknown as RootStore;
    const store = new PreferencesStore(root);

    const first = store.load();
    const second = store.load();
    resolveLoad?.(loaded);
    await Promise.all([first, second]);

    expect(getPreferences).toHaveBeenCalledTimes(1);
    expect(store.hasLoaded).toBe(true);
  });

  it("ignores a load that finishes after the account changes", async () => {
    let resolveFirst: ((value: FeedPreferencesByFeed) => void) | undefined;
    const firstRequest = new Promise<FeedPreferencesByFeed>((resolve) => {
      resolveFirst = resolve;
    });
    const getPreferences = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ ...loaded, random: { freshness: 4 } });
    const root = {
      services: { feedApiService: { getPreferences, patchPreferences: vi.fn() } },
    } as unknown as RootStore;
    const store = new PreferencesStore(root);

    store.activateAccount("account-a");
    store.activateAccount("account-b");
    await store.load();
    resolveFirst?.(loaded);
    await firstRequest;
    await Promise.resolve();

    expect(store.valuesFor("random").freshness).toBe(4);
  });

  it("retries preference loading after a failed request", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const getPreferences = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(loaded);
    const root = {
      services: { feedApiService: { getPreferences, patchPreferences: vi.fn() } },
    } as unknown as RootStore;
    const store = new PreferencesStore(root);

    await store.load();
    expect(store.hasLoaded).toBe(false);
    await store.load();

    expect(getPreferences).toHaveBeenCalledTimes(2);
    expect(store.hasLoaded).toBe(true);
    expect(store.valuesFor("best-of-friends").purpose).toBe(0.65);
    consoleError.mockRestore();
  });
});

describe("PreferencesStore.save", () => {
  it("updates only the selected feed", async () => {
    const patch = vi.fn().mockResolvedValue({ freshness: 2 });
    const { store } = makeStore(patch);
    await store.load();

    await store.save("best-of-friends", "freshness", 2);

    expect(patch).toHaveBeenCalledWith("best-of-friends", { freshness: 2 });
    expect(store.valuesFor("best-of-friends").freshness).toBe(2);
    expect(store.valuesFor("your-feed").freshness).toBe(5);
    expect(store.valuesFor("random").freshness).toBe(1);
  });

  it("rolls back only the failed feed and control", async () => {
    const { store, capture } = makeStore(vi.fn().mockRejectedValue(new Error("offline")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await store.load();

    await store.save("best-of-friends", "purpose", 0.8);

    expect(store.valuesFor("best-of-friends").purpose).toBe(0.65);
    expect(store.valuesFor("best-of-friends").freshness).toBe(3);
    expect(capture).toHaveBeenCalledWith(
      "feedControlChangeFailed",
      expect.objectContaining({ feed_name: "best-of-friends", control_name: "purpose" }),
    );
    consoleError.mockRestore();
  });

  it("does not let an older failed request roll back a newer save", async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    const firstRequest = new Promise<FeedPreferences>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const patch = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValueOnce({ freshness: 4 });
    const { store } = makeStore(patch);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await store.load();

    const firstSave = store.save("your-feed", "freshness", 2);
    const secondSave = store.save("your-feed", "freshness", 4);
    await vi.waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    rejectFirst?.(new Error("late failure"));
    await Promise.all([firstSave, secondSave]);

    expect(store.valuesFor("your-feed").freshness).toBe(4);
    consoleError.mockRestore();
  });

  it("does not roll back a successful sibling control when another save fails", async () => {
    let rejectSourceWeights: ((reason: Error) => void) | undefined;
    const sourceRequest = new Promise<FeedPreferences>((_resolve, reject) => {
      rejectSourceWeights = reject;
    });
    const patch = vi
      .fn()
      .mockReturnValueOnce(sourceRequest)
      .mockResolvedValueOnce({ purpose: 0.8 });
    const { store } = makeStore(patch);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await store.load();
    const requestedWeights = {
      following: 0.5,
      networkLikes: 0.2,
      authorsTopics: 0.15,
      popular: 0.15,
    };

    const sourceSave = store.save("your-feed", "source_weights", requestedWeights);
    const purposeSave = store.save("your-feed", "purpose", 0.8);
    await vi.waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    rejectSourceWeights?.(new Error("offline"));
    await Promise.all([sourceSave, purposeSave]);

    expect(store.valuesFor("your-feed").sourceWeights).toEqual(loaded["your-feed"]?.sourceWeights);
    expect(store.valuesFor("your-feed").purpose).toBe(0.8);
    consoleError.mockRestore();
  });

  it("does not apply a save response after sign-out", async () => {
    let resolveSave: ((value: FeedPreferences) => void) | undefined;
    const request = new Promise<FeedPreferences>((resolve) => {
      resolveSave = resolve;
    });
    const { store, capture } = makeStore(vi.fn().mockReturnValue(request));
    await store.load();

    const save = store.save("your-feed", "purpose", 0.8);
    store.reset();
    resolveSave?.({ purpose: 0.8 });
    await save;

    expect(store.valuesFor("your-feed").purpose).toBe(0.5);
    expect(capture).not.toHaveBeenCalled();
  });

  it("captures freshness semantics for the initiating feed", async () => {
    const { store, capture } = makeStore(vi.fn().mockResolvedValue({ freshness: 2 }));
    await store.load();

    await store.save("best-of-friends", "freshness", 2);

    expect(capture).toHaveBeenCalledWith("feedControlChanged", {
      control_name: "freshness",
      previous_value: 3,
      new_value: 2,
      previous_label: "48h",
      new_label: "24h",
      previous_hours: 48,
      new_hours: 24,
      feed_name: "best-of-friends",
      feed_label: "Best of Friends",
    });
  });

  it("captures Purpose weights for the selected feed", async () => {
    const { store, capture } = makeStore(vi.fn().mockResolvedValue({ purpose: 0.8 }));
    await store.load();

    await store.save("your-feed", "purpose", 0.8);

    expect(capture).toHaveBeenCalledWith(
      "feedControlChanged",
      expect.objectContaining({
        control_name: "purpose",
        previous_engaging_weight: 0.5,
        new_engaging_weight: 1 - 0.8,
        previous_constructive_weight: 0.5,
        new_constructive_weight: 0.8,
        feed_name: "your-feed",
      }),
    );
  });

  it("persists source weights atomically with their interaction origin", async () => {
    const next = {
      following: 0.5,
      networkLikes: 0.2,
      authorsTopics: 0.15,
      popular: 0.15,
    };
    const { store, capture } = makeStore(vi.fn().mockResolvedValue({ sourceWeights: next }));
    await store.load();

    await store.save("your-feed", "source_weights", next, "source_mix_master");

    expect(store.root.services.feedApiService.patchPreferences).toHaveBeenCalledWith("your-feed", {
      sourceWeights: next,
    });
    expect(store.valuesFor("your-feed").sourceWeights).toEqual(next);
    expect(capture).toHaveBeenCalledWith(
      "feedControlChanged",
      expect.objectContaining({
        control_name: "source_weights",
        previous_following_weight: 0.3,
        new_following_weight: 0.5,
        previous_network_likes_weight: 0.2,
        new_network_likes_weight: 0.2,
        previous_authors_topics_weight: 0.25,
        new_authors_topics_weight: 0.15,
        previous_popular_weight: 0.25,
        new_popular_weight: 0.15,
        change_origin: "source_mix_master",
        feed_name: "your-feed",
      }),
    );
  });
});

describe("PreferencesStore.savePatch", () => {
  it("saves every dirty control through one request and emits analytics after success", async () => {
    const patch = vi.fn().mockResolvedValue({ freshness: 2, purpose: 0.8 });
    const { store, capture } = makeStore(patch);
    await store.load();

    await expect(store.savePatch("your-feed", { freshness: 2, purpose: 0.8 })).resolves.toBe(true);

    expect(patch).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith("your-feed", { freshness: 2, purpose: 0.8 });
    expect(store.valuesFor("your-feed")).toMatchObject({ freshness: 2, purpose: 0.8 });
    expect(capture).toHaveBeenCalledWith(
      "feedControlChanged",
      expect.objectContaining({ control_name: "freshness", feed_name: "your-feed" }),
    );
    expect(capture).toHaveBeenCalledWith(
      "feedControlChanged",
      expect.objectContaining({ control_name: "purpose", feed_name: "your-feed" }),
    );
  });

  it("applies an already-accepted patch and emits analytics without another request", async () => {
    const patch = vi.fn();
    const { store, capture } = makeStore(patch);
    await store.load();

    store.applyAcceptedPatch(
      "your-feed",
      { freshness: 2, purpose: 0.8 },
      { freshness: 2, purpose: 0.8 },
    );

    expect(patch).not.toHaveBeenCalled();
    expect(store.valuesFor("your-feed")).toMatchObject({ freshness: 2, purpose: 0.8 });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("rolls the whole optimistic patch back while leaving the caller's draft intact", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { store, capture } = makeStore(vi.fn().mockRejectedValue(new Error("offline")));
    await store.load();

    await expect(store.savePatch("your-feed", { freshness: 2, purpose: 0.8 })).resolves.toBe(false);

    expect(store.valuesFor("your-feed")).toMatchObject({ freshness: 5, purpose: 0.5 });
    expect(capture).not.toHaveBeenCalledWith("feedControlChanged", expect.anything());
    consoleError.mockRestore();
  });

  it("lets Preview wait for the active feed's in-flight persistence", async () => {
    let resolvePatch: ((value: FeedPreferences) => void) | undefined;
    const patch = vi.fn().mockReturnValue(
      new Promise<FeedPreferences>((resolve) => {
        resolvePatch = resolve;
      }),
    );
    const { store } = makeStore(patch);
    await store.load();

    const saving = store.savePatch("your-feed", { freshness: 2 });
    const waiting = store.waitForPendingSaves("your-feed");
    let settled = false;
    void waiting.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolvePatch?.({ freshness: 2 });
    await expect(saving).resolves.toBe(true);
    await expect(waiting).resolves.toBe(true);
  });

  it("serializes overlapping saves per feed and persists the newest value last", async () => {
    let resolveFirst: ((value: FeedPreferences) => void) | undefined;
    const firstRequest = new Promise<FeedPreferences>((resolve) => {
      resolveFirst = resolve;
    });
    const patch = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValueOnce({ freshness: 4 });
    const { store } = makeStore(patch);
    await store.load();

    const first = store.savePatch("your-feed", { freshness: 2 });
    const second = store.savePatch("your-feed", { freshness: 4 });
    expect(store.valuesFor("your-feed").freshness).toBe(4);
    await vi.waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });

    resolveFirst?.({ freshness: 2 });
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);

    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenNthCalledWith(1, "your-feed", { freshness: 2 });
    expect(patch).toHaveBeenNthCalledWith(2, "your-feed", { freshness: 4 });
    expect(store.valuesFor("your-feed").freshness).toBe(4);
  });

  it("re-persists an unchanged snapshot without emitting duplicate analytics", async () => {
    const patch = vi.fn().mockResolvedValue({ freshness: 5 });
    const { store, capture } = makeStore(patch);
    await store.load();

    await expect(store.syncSnapshot("your-feed", { freshness: 5 })).resolves.toBe(true);

    expect(patch).toHaveBeenCalledWith("your-feed", { freshness: 5 });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("PreferencesStore.restoreDefaults", () => {
  it("persists all changed GreenEarth controls in one atomic patch", async () => {
    const defaults = {
      sourceWeights: {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      },
      freshness: 5,
      purpose: 0.5,
    };
    const patch = vi.fn().mockResolvedValue(defaults);
    const { store, capture } = makeStore(patch);
    await store.load();
    store.valuesByFeed["your-feed"] = {
      ...store.valuesFor("your-feed"),
      sourceWeights: {
        following: 0.6,
        networkLikes: 0.1,
        authorsTopics: 0.2,
        popular: 0.1,
      },
      freshness: 2,
      purpose: 0.65,
    };

    await expect(store.restoreDefaults("your-feed")).resolves.toBe(true);

    expect(patch).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith("your-feed", defaults);
    expect(store.valuesFor("your-feed")).toMatchObject(defaults);
    expect(capture).toHaveBeenCalledWith(
      "feedControlChanged",
      expect.objectContaining({
        feed_name: "your-feed",
        control_name: "source_weights",
        change_origin: "reset_defaults",
      }),
    );
  });

  it("includes Sources when loaded control metadata is incomplete", async () => {
    const patch = vi.fn().mockResolvedValue({
      sourceWeights: {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      },
    });
    const { store } = makeStore(patch);
    await store.load();
    store.controlsByFeed["your-feed"] = ["freshness", "purpose"];
    store.valuesByFeed["your-feed"] = {
      ...store.valuesFor("your-feed"),
      sourceWeights: {
        following: 0.6,
        networkLikes: 0.1,
        authorsTopics: 0.2,
        popular: 0.1,
      },
    };

    await store.restoreDefaults("your-feed");

    expect(patch).toHaveBeenCalledWith("your-feed", {
      sourceWeights: {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      },
    });
  });

  it("does not rebound to stale response values after a successful reset", async () => {
    const staleResponse = {
      sourceWeights: {
        following: 0.6,
        networkLikes: 0.1,
        authorsTopics: 0.2,
        popular: 0.1,
      },
      freshness: 2,
      purpose: 0.65,
    };
    const { store } = makeStore(vi.fn().mockResolvedValue(staleResponse));
    await store.load();
    store.valuesByFeed["your-feed"] = {
      ...store.valuesFor("your-feed"),
      ...staleResponse,
    };

    await expect(store.restoreDefaults("your-feed")).resolves.toBe(true);

    expect(store.valuesFor("your-feed")).toMatchObject({
      sourceWeights: {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      },
      freshness: 5,
      purpose: 0.5,
    });
  });

  it("resets only controls supported by the selected feed", async () => {
    const patch = vi.fn().mockResolvedValue({ freshness: 5, purpose: 0.5 });
    const { store } = makeStore(patch);
    await store.load();

    await store.restoreDefaults("best-of-friends");

    expect(patch).toHaveBeenCalledWith("best-of-friends", {
      freshness: 5,
      purpose: 0.5,
    });
    expect(store.valuesFor("best-of-friends")).toMatchObject({
      freshness: 5,
      purpose: 0.5,
    });
    expect(store.valuesFor("random").freshness).toBe(1);
  });

  it("rolls back reset controls without overwriting a newer edit", async () => {
    let rejectReset: ((reason: Error) => void) | undefined;
    const resetRequest = new Promise<FeedPreferences>((_resolve, reject) => {
      rejectReset = reject;
    });
    const patch = vi.fn().mockReturnValueOnce(resetRequest).mockResolvedValueOnce({ freshness: 2 });
    const { store } = makeStore(patch);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await store.load();
    store.valuesByFeed["your-feed"] = {
      ...store.valuesFor("your-feed"),
      sourceWeights: {
        following: 0.6,
        networkLikes: 0.1,
        authorsTopics: 0.2,
        popular: 0.1,
      },
      freshness: 3,
      purpose: 0.65,
    };

    const reset = store.restoreDefaults("your-feed");
    const save = store.save("your-feed", "freshness", 2);
    await vi.waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    rejectReset?.(new Error("offline"));
    await expect(Promise.all([reset, save])).resolves.toEqual([false, undefined]);

    expect(store.valuesFor("your-feed")).toMatchObject({
      sourceWeights: {
        following: 0.6,
        networkLikes: 0.1,
        authorsTopics: 0.2,
        popular: 0.1,
      },
      freshness: 2,
      purpose: 0.65,
    });
    consoleError.mockRestore();
  });
});

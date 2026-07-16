import { describe, expect, it, vi } from "vitest";
import type { Preferences } from "../services/types";
import type { RootStore } from "../stores/root-store";
import { PreferencesStore } from "../stores/preferences-store";

const defaults: Preferences = {
  socialRadius: 2,
  freshness: 2,
  politics: 1,
  purpose: 0.5,
};

function makeStore(putPreferences: (values: Preferences) => Promise<Preferences>) {
  const root = {
    services: { feedApiService: { putPreferences, getPreferences: vi.fn() } },
  } as unknown as RootStore;
  return new PreferencesStore(root);
}

describe("PreferencesStore.load", () => {
  it("shares one in-flight load and keeps the loaded values", async () => {
    let resolveLoad: ((value: Preferences) => void) | undefined;
    const getPreferences = vi.fn().mockReturnValue(
      new Promise<Preferences>((resolve) => { resolveLoad = resolve; }),
    );
    const root = {
      services: { feedApiService: { getPreferences, putPreferences: vi.fn() } },
    } as unknown as RootStore;
    const store = new PreferencesStore(root);

    const first = store.load();
    const second = store.load();
    resolveLoad?.({ ...defaults, socialRadius: 4 });
    await Promise.all([first, second]);

    expect(getPreferences).toHaveBeenCalledTimes(1);
    expect(store.hasLoaded).toBe(true);
    expect(store.values.socialRadius).toBe(4);
  });
});

describe("PreferencesStore.save", () => {
  it("uses the preferences returned by the API", async () => {
    const saved = { ...defaults, socialRadius: 3 };
    const store = makeStore(vi.fn().mockResolvedValue(saved));

    await store.save({ ...defaults, socialRadius: 4 });

    expect(store.values).toEqual(saved);
  });

  it("rolls back the latest optimistic update when saving fails", async () => {
    const store = makeStore(vi.fn().mockRejectedValue(new Error("offline")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await store.save({ ...defaults, socialRadius: 4 });

    expect(store.values).toEqual(defaults);
    consoleError.mockRestore();
  });

  it("does not let an older failed request roll back a newer save", async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    const firstRequest = new Promise<Preferences>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const putPreferences = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ ...defaults, socialRadius: 4 });
    const store = makeStore(putPreferences);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const firstSave = store.save({ ...defaults, socialRadius: 3 });
    await store.save({ ...defaults, socialRadius: 4 });
    rejectFirst?.(new Error("late failure"));
    await firstSave;

    expect(store.values.socialRadius).toBe(4);
    consoleError.mockRestore();
  });
});

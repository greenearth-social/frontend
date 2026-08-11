import { beforeEach, describe, expect, it } from "vitest";
import { UIStore } from "../stores/ui-store";

const STORAGE_KEY = "greenearth:last-selected-feed:v1";

describe("UIStore remembered feed", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults a new account to GreenEarth and remembers later selections", () => {
    const firstSession = new UIStore();
    firstSession.activateAccount("account-a");
    expect(firstSession.selectedAlgorithm).toBe("your-feed");

    firstSession.setSelectedAlgorithm("random");
    const nextSession = new UIStore();
    nextSession.activateAccount("account-a");
    expect(nextSession.selectedAlgorithm).toBe("random");
  });

  it("keeps remembered selections isolated by account", () => {
    const store = new UIStore();
    store.activateAccount("account-a");
    store.setSelectedAlgorithm("best-of-friends");
    store.activateAccount("account-b");
    store.setSelectedAlgorithm("random");
    store.activateAccount("account-a");

    expect(store.selectedAlgorithm).toBe("best-of-friends");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      "account-a": "best-of-friends",
      "account-b": "random",
    });
  });

  it("falls back safely for corrupt or unsupported stored values", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");
    const corruptStore = new UIStore();
    corruptStore.activateAccount("account-a");
    expect(corruptStore.selectedAlgorithm).toBe("your-feed");

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ "account-a": "removed-feed" }),
    );
    const invalidStore = new UIStore();
    invalidStore.activateAccount("account-a");
    expect(invalidStore.selectedAlgorithm).toBe("your-feed");
  });

  it("clears in-memory selection on sign-out without deleting the memory", () => {
    const store = new UIStore();
    store.activateAccount("account-a");
    store.setSelectedAlgorithm("random");
    store.deactivateAccount();
    expect(store.selectedAlgorithm).toBeNull();

    store.activateAccount("account-a");
    expect(store.selectedAlgorithm).toBe("random");
  });
});

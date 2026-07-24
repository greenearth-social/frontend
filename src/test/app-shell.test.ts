import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    authStore: {
      isSignedIn: true,
      signOut: vi.fn<() => Promise<void>>(),
    },
    accountStore: {
      activeAccount: {
        displayName: "Alice",
        handle: "alice.test",
      },
    },
    feedStore: {
      feedList: [],
      isLoading: true,
      error: null,
      currentRequestId: null,
      filteringCountsByRequest: {},
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      postsPerPage: 10,
      loadFeedList: vi.fn(),
    },
    uiStore: {
      selectedItemUri: null,
    },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import { AppShell } from "../components/app-shell";

describe("AppShell authentication UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.location.hash = "/feed";
    testState.rootStore.authStore.isSignedIn = true;
    testState.rootStore.authStore.signOut.mockReset();
  });

  it("centers the completing-sign-in state without relying on global utility styles", async () => {
    window.location.hash = "/auth/finish";
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".auth-progress")?.textContent).toContain(
      "Completing sign in",
    );
    expect(AppShell.styles.cssText).toMatch(
      /\.auth-progress\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    );
  });

  it("closes the mobile drawer before signing out", async () => {
    const element = document.createElement("app-shell");
    document.body.appendChild(element);
    await element.updateComplete;

    const feedPage = element.shadowRoot?.querySelector("feed-page");
    await feedPage?.updateComplete;
    feedPage?.shadowRoot?.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector(".drawer")?.classList.contains("open")).toBe(true);

    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".drawer .more-btn")
      ?.click();
    await element.updateComplete;
    testState.rootStore.authStore.signOut.mockImplementation(() => {
      expect(element.shadowRoot?.querySelector(".drawer")?.classList.contains("open")).toBe(false);
      return Promise.resolve();
    });
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>(".drawer .logout-btn")
      ?.click();

    await vi.waitFor(() => {
      expect(testState.rootStore.authStore.signOut).toHaveBeenCalledOnce();
    });
  });
});

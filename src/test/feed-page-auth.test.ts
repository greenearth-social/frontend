import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  capture: vi.fn(),
  rootStore: {
    authStore: { isSignedIn: false },
    accountStore: { activeAccount: null },
    feedStore: {},
    uiStore: {},
    services: { analyticsService: { capture: vi.fn() } },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../pages/feed-page";

describe("FeedPage sign in", () => {
  beforeEach(() => {
    window.location.hash = "#/controls";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  beforeEach(() => {
    testState.rootStore.services.analyticsService.capture.mockReset();
  });

  it("shows one handle-first sign-in form for every account provider", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll("form")).toHaveLength(1);
    expect(element.shadowRoot?.querySelector(".bluesky-sign-in")).toBeNull();
    expect(element.shadowRoot?.querySelector(".custom-pds-toggle")).toBeNull();
    expect(element.shadowRoot?.querySelector(".sign-in-divider")).toBeNull();
    expect(element.shadowRoot?.querySelector("label")?.textContent).toContain("Account handle");
    expect(
      element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle")?.placeholder,
    ).toBe("alice.bsky.social");
    expect(element.shadowRoot?.querySelector("#handle-help")).toBeNull();
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>("button[type=submit]")?.textContent,
    ).toContain("Continue");
  });

  it("renders and dismisses an auth callback failure through the login alert", async () => {
    const element = document.createElement("feed-page");
    element.authFailureMessage = "We couldn't sign you in. Please try again.";
    const dismissed = vi.fn();
    element.addEventListener("auth-failure-dismissed", dismissed);
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
      "We couldn't sign you in",
    );
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle");
    input?.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(dismissed).toHaveBeenCalledOnce();
  });

  it("normalizes the handle and preserves the return route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ redirectUrl: "https://pds.example/oauth/authorize" })),
      );
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle");
    const form = element.shadowRoot?.querySelector<HTMLFormElement>("form");
    if (!input || !form) throw new Error("Sign-in form did not render");

    input.value = "  @Alice.Example.com ";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    const request = fetchMock.mock.calls[0]?.[0];
    if (typeof request !== "string") throw new Error("Expected sign-in to use a URL string");
    const requestedUrl = new URL(request, "https://app.example.com");
    expect(requestedUrl.pathname).toBe("/auth/bluesky");
    expect(requestedUrl.searchParams.get("handle")).toBe("alice.example.com");
    expect(requestedUrl.searchParams.get("return_url")).toBe("/controls");
    expect(
      element.shadowRoot?.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled,
    ).toBe(true);
  });

  it("shows validation and OAuth startup errors", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle");
    const form = element.shadowRoot?.querySelector<HTMLFormElement>("form");
    if (!input || !form) throw new Error("Sign-in form did not render");

    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
      "Enter a valid handle",
    );
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "signInFailed",
      {
        failure_stage: "validation",
        error_category: "invalid_handle",
      },
    );

    input.value = "https://pds.example.com";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
      "Enter a valid handle",
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Handle could not be resolved", { status: 400 }),
    );
    input.value = "alice.example.com";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
        "Handle could not be resolved",
      );
    });
    expect(testState.rootStore.services.analyticsService.capture).toHaveBeenCalledWith(
      "signInFailed",
      {
        failure_stage: "initiation",
        error_category: "request_failed",
      },
    );

    input.value = "bob.bsky.social";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector("[role=alert]")).toBeNull();
  });

  it("uses a compact logo and spacing on tiny screens", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const styles = element.shadowRoot?.textContent ?? "";
    expect(styles).toContain("@media (max-height: 560px), (max-width: 360px)");
    expect(styles).toContain("width: 96px");
  });
});

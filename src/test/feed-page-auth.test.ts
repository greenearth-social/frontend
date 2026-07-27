import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  rootStore: {
    authStore: { isSignedIn: false },
    accountStore: { activeAccount: null },
    feedStore: {},
    uiStore: {},
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../pages/feed-page";

describe("FeedPage sign in", () => {
  async function openCustomPdsForm(element: HTMLElement & { updateComplete: Promise<boolean> }) {
    element.shadowRoot?.querySelector<HTMLButtonElement>(".custom-pds-toggle")?.click();
    await element.updateComplete;
  }

  beforeEach(() => {
    window.location.hash = "#/controls";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("keeps both sign-in choices obvious while collapsing the custom-PDS form", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".bluesky-sign-in")?.textContent).toContain(
      "Sign in with Bluesky",
    );
    expect(element.shadowRoot?.querySelector(".custom-pds-toggle")?.textContent).toContain(
      "Sign in with a custom PDS",
    );
    expect(element.shadowRoot?.querySelector("#account-handle")).toBeNull();

    await openCustomPdsForm(element);
    expect(element.shadowRoot?.querySelector("label")?.textContent).toContain("Account handle");
    expect(element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle")?.placeholder).toBe(
      "alice.example.com",
    );
  });

  it("uses a compact logo and spacing on tiny screens", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    const styles = element.shadowRoot?.textContent ?? "";
    expect(styles).toContain("@media (max-height: 560px), (max-width: 360px)");
    expect(styles).toContain("width: 96px");
  });

  it("starts Bluesky sign-in without requiring a handle", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ redirectUrl: "https://bsky.social/oauth/authorize" })),
      );
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".bluesky-sign-in")?.click();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/auth/bluesky?return_url=%2Fcontrols");
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
    await openCustomPdsForm(element);
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
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(
      true,
    );
  });

  it("shows validation and OAuth startup errors", async () => {
    const element = document.createElement("feed-page");
    document.body.appendChild(element);
    await element.updateComplete;
    await openCustomPdsForm(element);
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("#account-handle");
    const form = element.shadowRoot?.querySelector<HTMLFormElement>("form");
    if (!input || !form) throw new Error("Sign-in form did not render");

    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
      "Enter a valid handle",
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Handle could not be resolved", { status: 400 }));
    input.value = "alice.example.com";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(element.shadowRoot?.querySelector("[role=alert]")?.textContent).toContain(
        "Handle could not be resolved",
      );
    });
  });
});

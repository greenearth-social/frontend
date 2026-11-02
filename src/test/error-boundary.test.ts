import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reportClientError: vi.fn(),
}));

vi.mock("../services/telemetry/telemetry-service", () => mocks);

import "../components/error-boundary";
import type { ErrorBoundary } from "../components/error-boundary";

describe("ErrorBoundary", () => {
  let element: ErrorBoundary;

  beforeEach(() => {
    vi.clearAllMocks();
    element = document.createElement("error-boundary");
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  it("renders children in slot under normal conditions", async () => {
    const child = document.createElement("div");
    child.textContent = "Safe Content";
    element.appendChild(child);

    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".error-container")).toBeNull();
    expect(element.shadowRoot?.querySelector("slot")).not.toBeNull();
  });

  it("displays fallback UI and reports client error when catchError is invoked", async () => {
    element.boundaryName = "FeedPage";
    element.catchError(new Error("Feed rendering blew up"));

    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".error-container")).not.toBeNull();
    expect(element.shadowRoot?.textContent).toContain("Feed rendering blew up");
    expect(mocks.reportClientError).toHaveBeenCalledWith(
      "FeedPage:RenderError",
      expect.objectContaining({
        message: "Feed rendering blew up",
      }),
    );
  });

  it("resets error state when retry button is clicked", async () => {
    element.catchError(new Error("Temporary error"));
    await element.updateComplete;

    const retryBtn = element.shadowRoot?.querySelector<HTMLButtonElement>(".retry-button");
    expect(retryBtn).not.toBeNull();

    retryBtn?.click();
    await element.updateComplete;

    expect(element.hasError).toBe(false);
    expect(element.shadowRoot?.querySelector(".error-container")).toBeNull();
  });
});

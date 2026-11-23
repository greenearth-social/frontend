import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onLCP: vi.fn(),
  onINP: vi.fn(),
  onCLS: vi.fn(),
}));

vi.mock("web-vitals", () => mocks);

import {
  currentAppRoute,
  getTelemetryEndpoint,
  initTelemetry,
  reportClientError,
  reportMetric,
  resetTelemetryForTest,
  sendTelemetry,
  setIsInitializedForTest,
} from "../services/telemetry/telemetry-service";

describe("TelemetryService", () => {
  let originalSendBeacon: typeof navigator.sendBeacon;
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    resetTelemetryForTest();
    vi.clearAllMocks();

    originalSendBeacon = navigator.sendBeacon;
    originalFetch = window.fetch;
  });

  afterEach(() => {
    resetTelemetryForTest();
    navigator.sendBeacon = originalSendBeacon;
    window.fetch = originalFetch;
  });

  it("extracts current app route from hash", () => {
    window.location.hash = "#/settings/your-feed?tab=weights";
    expect(currentAppRoute()).toBe("/settings/your-feed");

    window.location.hash = "";
    expect(currentAppRoute()).toBe("/feed");
  });

  it("sends telemetry via navigator.sendBeacon when available", () => {
    setIsInitializedForTest(true);
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = mockSendBeacon;

    const success = sendTelemetry({
      type: "vitals",
      name: "LCP",
      value: 1250.4,
    });

    expect(success).toBe(true);
    expect(mockSendBeacon).toHaveBeenCalledOnce();
    const [endpoint, blob] = mockSendBeacon.mock.calls[0] as [string, Blob];
    expect(endpoint).toBe("/api/telemetry");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
  });

  it("falls back to fetch if sendBeacon is unavailable or returns false", () => {
    setIsInitializedForTest(true);
    navigator.sendBeacon = vi.fn().mockReturnValue(false);
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    window.fetch = mockFetch;

    const success = sendTelemetry({
      type: "error",
      name: "FeedRenderError",
      extra: { message: "Failed to render card" },
    });

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/telemetry",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }),
    );
  });

  it("reports Core Web Vitals accurately formatted", () => {
    setIsInitializedForTest(true);
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = mockSendBeacon;
    window.location.hash = "#/feed";

    reportMetric({
      name: "LCP",
      value: 1420.456,
      rating: "good",
      delta: 1420.456,
      id: "v1-1234",
      entries: [],
      navigationType: "navigate",
      navigationId: 1,
    });

    expect(mockSendBeacon).toHaveBeenCalledOnce();
    const [, blob] = mockSendBeacon.mock.calls[0] as [string, Blob];
    expect(blob.type).toBe("application/json");
  });

  it("deduplicates identical client errors within short window", () => {
    setIsInitializedForTest(true);
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = mockSendBeacon;

    const first = reportClientError("SettingsSaveError", { message: "500 Internal Error" });
    const duplicate = reportClientError("SettingsSaveError", { message: "500 Internal Error" });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
  });

  it("initializes web-vitals and listens for global unhandled errors", () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = mockSendBeacon;

    const cleanup = initTelemetry({
      apiBaseUrl: "https://api.greenearth.social",
    });

    expect(getTelemetryEndpoint()).toBe("https://api.greenearth.social/api/telemetry");
    expect(mocks.onLCP).toHaveBeenCalledOnce();
    expect(mocks.onINP).toHaveBeenCalledOnce();
    expect(mocks.onCLS).toHaveBeenCalledOnce();

    // Trigger window error event
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Uncaught TypeError: cannot read property of null",
        error: new TypeError("cannot read property of null"),
      }),
    );

    expect(mockSendBeacon).toHaveBeenCalled();

    cleanup();
  });
});

import { describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

import {
  NoopAnalyticsService,
  PostHogAnalyticsService,
  createAnalyticsService,
  type PostHogClient,
} from "../services/analytics/analytics-service";

describe("AnalyticsService", () => {
  it("adds common production properties and sanitizes the app route", () => {
    window.location.hash = "#/auth/finish?token=secret";
    const client: PostHogClient = {
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    const service = new PostHogAnalyticsService(
      client,
      "production",
      "frontend-sha",
    );

    service.capture("signInFailed", {
      failure_stage: "callback",
      error_category: "token_exchange_failed",
    });

    expect(client.capture).toHaveBeenCalledWith("signInFailed", {
      surface: "greenearth_web",
      environment: "production",
      frontend_release_sha: "frontend-sha",
      app_route: "/auth/finish",
      schema_version: 1,
      failure_stage: "callback",
      error_category: "token_exchange_failed",
    });
    expect(JSON.stringify(vi.mocked(client.capture).mock.calls)).not.toContain(
      "secret",
    );
  });

  it("deduplicates identification and resets the browser identity", () => {
    const client: PostHogClient = {
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    const service = new PostHogAnalyticsService(client, "production", null);

    service.identify("did:plc:alice");
    service.identify("did:plc:alice");
    service.reset();
    service.identify("did:plc:alice");

    expect(client.identify).toHaveBeenCalledTimes(2);
    expect(client.reset).toHaveBeenCalledOnce();
  });

  it("returns a no-op service outside production", async () => {
    const service = await createAnalyticsService({
      environment: "stage",
      frontendReleaseSha: "sha",
      posthog: {
        mode: "posthog",
        projectKey: "phc_project",
        host: "https://us.i.posthog.com",
      },
      feedback: { mode: "test" },
    });

    expect(service).toBeInstanceOf(NoopAnalyticsService);
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("initializes the shared PostHog client once in production", async () => {
    posthogMock.init.mockReset();
    const service = await createAnalyticsService({
      environment: "production",
      frontendReleaseSha: "sha",
      posthog: {
        mode: "posthog",
        projectKey: "phc_project",
        host: "https://us.i.posthog.com",
      },
      feedback: { mode: "posthog", surveys: {} },
    });

    expect(service).toBeInstanceOf(PostHogAnalyticsService);
    expect(posthogMock.init).toHaveBeenCalledOnce();
    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_project",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
      }),
    );
  });
});

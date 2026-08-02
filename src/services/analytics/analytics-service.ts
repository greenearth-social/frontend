import type { RuntimeConfig } from "../../config/runtime-config";
import type {
  AnalyticsEventProperties,
  IAnalyticsService,
} from "./types";

export interface PostHogClient {
  capture(event: string, properties: Record<string, unknown>): unknown;
  identify(distinctId: string): void;
  reset(): void;
}

function currentAppRoute(): string {
  return window.location.hash.slice(1).split("?")[0] || "/feed";
}

export class NoopAnalyticsService implements IAnalyticsService {
  identify(_distinctId: string): void {}

  reset(): void {}

  capture<EventName extends keyof AnalyticsEventProperties>(
    _event: EventName,
    _properties: AnalyticsEventProperties[EventName],
  ): void {}
}

export class PostHogAnalyticsService implements IAnalyticsService {
  private identifiedId: string | null = null;

  constructor(
    private client: PostHogClient,
    private environment: string,
    private frontendReleaseSha: string | null,
  ) {}

  identify(distinctId: string): void {
    if (this.identifiedId === distinctId) return;
    this.client.identify(distinctId);
    this.identifiedId = distinctId;
  }

  reset(): void {
    this.client.reset();
    this.identifiedId = null;
  }

  capture<EventName extends keyof AnalyticsEventProperties>(
    event: EventName,
    properties: AnalyticsEventProperties[EventName],
  ): void {
    this.client.capture(event, {
      surface: "greenearth_web",
      environment: this.environment,
      frontend_release_sha: this.frontendReleaseSha,
      app_route: currentAppRoute(),
      schema_version: 1,
      ...properties,
    });
  }
}

export async function createAnalyticsService(
  config: RuntimeConfig,
): Promise<IAnalyticsService> {
  if (config.environment !== "production" || config.posthog.mode !== "posthog") {
    return new NoopAnalyticsService();
  }

  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(config.posthog.projectKey, {
      api_host: config.posthog.host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      person_profiles: "identified_only",
    });
    return new PostHogAnalyticsService(
      posthog,
      config.environment,
      config.frontendReleaseSha,
    );
  } catch (error) {
    console.error("Failed to initialize production analytics:", error);
    return new NoopAnalyticsService();
  }
}

import type {
  FeedbackRuntimeConfig,
  FeedbackSurface,
  RuntimeConfig,
  SurveyRuntimeConfig,
} from "../../config/runtime-config";
import type {
  FeedbackEventPayload,
  FeedbackSubmission,
  FeedbackSubmitResult,
  IFeedbackService,
} from "./types";

const PREVIEW_SURVEYS: Record<FeedbackSurface, SurveyRuntimeConfig> = {
  general: {
    surveyId: "preview-general-survey",
    questionId: "preview-general-question",
  },
  controls: {
    surveyId: "preview-controls-survey",
    questionId: "preview-controls-question",
  },
  howItWorks: {
    surveyId: "preview-how-it-works-survey",
    questionId: "preview-how-it-works-question",
  },
};

const SURFACE_EVENT_VALUES: Record<FeedbackSurface, string> = {
  general: "general",
  controls: "controls",
  howItWorks: "how_it_works",
};

export function buildFeedbackEvent(
  submission: FeedbackSubmission,
  survey: SurveyRuntimeConfig,
  frontendReleaseSha: string | null,
): FeedbackEventPayload {
  const properties: FeedbackEventPayload["properties"] = {
    $survey_id: survey.surveyId,
    [`$survey_response_${survey.questionId}`]: submission.response,
    feedback_surface: SURFACE_EVENT_VALUES[submission.surface],
    app_route: submission.appRoute,
    frontend_release_sha: frontendReleaseSha,
    snapshot_context_available: submission.snapshot !== null,
    social_radius: submission.preferences.socialRadius,
    freshness: submission.preferences.freshness,
    politics: submission.preferences.politics,
    purpose: submission.preferences.purpose,
  };

  if (submission.snapshot) {
    properties.feed_snapshot_id = submission.snapshot.requestId;
    properties.feed_name = submission.snapshot.feedName;
    properties.feed_generated_at = submission.snapshot.generatedAt;
    properties.api_release_sha = submission.snapshot.apiReleaseSha;
    properties.feed_stored_item_count = submission.snapshot.storedItemCount;
    properties.feed_displayed_item_count = submission.snapshot.displayedItemCount;
    properties.feed_publicly_filtered_count =
      submission.snapshot.publiclyFilteredCount;
    properties.feed_unavailable_count = submission.snapshot.unavailableCount;
  }

  return {
    event: "survey sent",
    distinct_id: submission.distinctId,
    properties,
  };
}

class TestFeedbackService implements IFeedbackService {
  readonly mode = "test" as const;
  readonly unavailableReason = null;

  constructor(private frontendReleaseSha: string | null) {}

  identify(_distinctId: string): void {}

  reset(): void {}

  submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    return Promise.resolve({
      sent: false,
      payload: buildFeedbackEvent(
        submission,
        PREVIEW_SURVEYS[submission.surface],
        this.frontendReleaseSha,
      ),
    });
  }
}

class UnavailableFeedbackService implements IFeedbackService {
  readonly mode = "unavailable" as const;

  constructor(readonly unavailableReason: string) {}

  identify(_distinctId: string): void {}

  reset(): void {}

  submit(_submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    return Promise.reject(new Error(this.unavailableReason));
  }
}

export interface PostHogClient {
  capture(event: string, properties: Record<string, unknown>): unknown;
  identify(distinctId: string): void;
  reset(): void;
}

export class PostHogFeedbackService implements IFeedbackService {
  readonly mode = "posthog" as const;
  readonly unavailableReason = null;
  private identifiedId: string | null = null;

  constructor(
    private client: PostHogClient,
    private surveys: Record<FeedbackSurface, SurveyRuntimeConfig>,
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

  submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    this.identify(submission.distinctId);
    const payload = buildFeedbackEvent(
      submission,
      this.surveys[submission.surface],
      this.frontendReleaseSha,
    );
    this.client.capture(payload.event, payload.properties);
    return Promise.resolve({ sent: true, payload });
  }
}

async function createPostHogService(
  feedback: Extract<FeedbackRuntimeConfig, { mode: "posthog" }>,
  frontendReleaseSha: string | null,
): Promise<IFeedbackService> {
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(feedback.projectKey, {
      api_host: feedback.host,
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
    return new PostHogFeedbackService(
      posthog,
      feedback.surveys,
      frontendReleaseSha,
    );
  } catch (error) {
    console.error("Failed to initialize production feedback:", error);
    return new UnavailableFeedbackService(
      "Feedback is temporarily unavailable.",
    );
  }
}

export async function createFeedbackService(
  config: RuntimeConfig,
): Promise<IFeedbackService> {
  if (config.feedback.mode === "posthog") {
    return createPostHogService(config.feedback, config.frontendReleaseSha);
  }
  if (config.feedback.mode === "unavailable") {
    return new UnavailableFeedbackService(config.feedback.reason);
  }
  return new TestFeedbackService(config.frontendReleaseSha);
}

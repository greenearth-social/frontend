import type {
  FeedbackSurface,
  RuntimeConfig,
  SurveyRuntimeConfig,
} from "../../config/runtime-config";
import type { IAnalyticsService } from "../analytics/types";
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

  unavailableReasonFor(_surface: FeedbackSurface): string | null {
    return null;
  }

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

  unavailableReasonFor(_surface: FeedbackSurface): string {
    return this.unavailableReason;
  }

  submit(_submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    return Promise.reject(new Error(this.unavailableReason));
  }
}

export class PostHogFeedbackService implements IFeedbackService {
  readonly mode = "posthog" as const;
  readonly unavailableReason = null;

  constructor(
    private analytics: IAnalyticsService,
    private surveys: Partial<Record<FeedbackSurface, SurveyRuntimeConfig>>,
    private frontendReleaseSha: string | null,
  ) {}

  unavailableReasonFor(surface: FeedbackSurface): string | null {
    return this.surveys[surface]
      ? null
      : "Feedback is temporarily unavailable on this page.";
  }

  submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    const survey = this.surveys[submission.surface];
    if (!survey) {
      return Promise.reject(
        new Error("Feedback is temporarily unavailable on this page."),
      );
    }
    this.analytics.identify(submission.distinctId);
    const payload = buildFeedbackEvent(
      submission,
      survey,
      this.frontendReleaseSha,
    );
    this.analytics.capture(payload.event, payload.properties);
    return Promise.resolve({ sent: true, payload });
  }
}

export function createFeedbackService(
  config: RuntimeConfig,
  analytics: IAnalyticsService,
): IFeedbackService {
  if (config.feedback.mode === "posthog") {
    return new PostHogFeedbackService(
      analytics,
      config.feedback.surveys,
      config.frontendReleaseSha,
    );
  }
  if (config.feedback.mode === "unavailable") {
    return new UnavailableFeedbackService(config.feedback.reason);
  }
  return new TestFeedbackService(config.frontendReleaseSha);
}

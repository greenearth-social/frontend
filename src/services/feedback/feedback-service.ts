import type {
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

const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERY_ERROR =
  "We couldn't confirm your feedback was received. Check your connection or browser's tracking protection, then try again.";

interface PostHogFeedbackConfig {
  projectKey: string;
  host: string;
  frontendReleaseSha: string | null;
  surveys: Partial<Record<FeedbackSurface, SurveyRuntimeConfig>>;
}

export function buildFeedbackEvent(
  submission: FeedbackSubmission,
  survey: SurveyRuntimeConfig,
): FeedbackEventPayload {
  const surface = SURFACE_EVENT_VALUES[submission.surface];
  const snapshot =
    submission.snapshot?.feedName === submission.feedName ? submission.snapshot : null;
  const properties: FeedbackEventPayload["properties"] = {
    $survey_id: survey.surveyId,
    $survey_submission_id: submission.submissionId,
    $survey_completed: true,
    [`$survey_response_${survey.questionId}`]: submission.response,
    feedback_submission_id: submission.submissionId,
    feedback_surface: surface,
    feedback_context_key: `${surface}:${submission.feedName}`,
    feed_name: submission.feedName,
    feed_label: submission.feedLabel,
    app_route: submission.appRoute,
    api_release_sha: submission.apiReleaseSha,
    snapshot_context_available: snapshot !== null,
    source_following_weight: submission.preferences.sourceWeights.following,
    source_network_likes_weight: submission.preferences.sourceWeights.networkLikes,
    source_authors_topics_weight: submission.preferences.sourceWeights.authorsTopics,
    source_popular_weight: submission.preferences.sourceWeights.popular,
    source_llm_weight: submission.preferences.sourceWeights.llm,
    freshness: submission.preferences.freshness,
    politics: submission.preferences.politics,
    purpose: submission.preferences.purpose,
  };

  if (snapshot) {
    properties.feed_snapshot_id = snapshot.requestId;
    properties.feed_generated_at = snapshot.generatedAt;
    properties.feed_stored_item_count = snapshot.storedItemCount;
    properties.feed_displayed_item_count = snapshot.displayedItemCount;
    properties.feed_publicly_filtered_count = snapshot.publiclyFilteredCount;
    properties.feed_unavailable_count = snapshot.unavailableCount;
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

  unavailableReasonFor(_surface: FeedbackSurface): string | null {
    return null;
  }

  submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    return Promise.resolve({
      sent: false,
      payload: buildFeedbackEvent(submission, PREVIEW_SURVEYS[submission.surface]),
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

  constructor(private config: PostHogFeedbackConfig) {}

  unavailableReasonFor(surface: FeedbackSurface): string | null {
    return this.config.surveys[surface]
      ? null
      : "Feedback is temporarily unavailable on this page.";
  }

  async submit(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
    const survey = this.config.surveys[submission.surface];
    if (!survey) {
      throw new Error("Feedback is temporarily unavailable on this page.");
    }
    if (!submission.distinctId.trim() || !submission.response.trim()) {
      throw new Error("Sign in and enter your feedback before sending.");
    }
    const payload = buildFeedbackEvent(submission, survey);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, DELIVERY_TIMEOUT_MS);

    try {
      // The browser SDK's capture() returns before delivery and has no receipt callback.
      // Send this user-submitted message once, and require the capture API's acknowledgement.
      const response = await fetch(`${this.config.host.replace(/\/+$/, "")}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        signal: controller.signal,
        body: JSON.stringify({
          api_key: this.config.projectKey,
          ...payload,
          properties: {
            $host: window.location.host,
            $pathname: window.location.pathname,
            $current_url: `${window.location.origin}${window.location.pathname}#${submission.appRoute}`,
            surface: "greenearth_web",
            environment: "production",
            frontend_release_sha: this.config.frontendReleaseSha,
            schema_version: 1,
            ...payload.properties,
          },
        }),
      });
      if (!response.ok) throw new Error(DELIVERY_ERROR);

      const receipt: unknown = await response.json();
      if (
        typeof receipt !== "object" ||
        receipt === null ||
        !("status" in receipt) ||
        (receipt.status !== "Ok" && receipt.status !== 1)
      ) {
        throw new Error(DELIVERY_ERROR);
      }
      // This confirms acceptance by PostHog, not subsequent Discord delivery.
      return { sent: true, payload };
    } catch {
      throw new Error(
        controller.signal.aborted
          ? "We couldn't confirm delivery in time. Your feedback is still here. Please try again."
          : DELIVERY_ERROR,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createFeedbackService(config: RuntimeConfig): IFeedbackService {
  if (config.feedback.mode === "unavailable") {
    return new UnavailableFeedbackService(config.feedback.reason);
  }
  if (config.environment !== "production") return new TestFeedbackService();
  if (config.feedback.mode === "posthog") {
    if (config.posthog.mode !== "posthog") {
      return new UnavailableFeedbackService("Feedback delivery is temporarily unavailable.");
    }
    return new PostHogFeedbackService({
      projectKey: config.posthog.projectKey,
      host: config.posthog.host,
      frontendReleaseSha: config.frontendReleaseSha,
      surveys: config.feedback.surveys,
    });
  }
  return new TestFeedbackService();
}

import { describe, expect, it, vi } from "vitest";
import {
  PostHogFeedbackService,
  buildFeedbackEvent,
  createFeedbackService,
} from "../services/feedback/feedback-service";
import type { IAnalyticsService } from "../services/analytics/types";
import type { FeedbackSubmission } from "../services/feedback/types";

const submission: FeedbackSubmission = {
  submissionId: "feedback-submission-1",
  distinctId: "did:plc:user",
  surface: "controls",
  response: "Let me tune topic diversity.",
  appRoute: "/settings",
  feedName: "your-feed",
  feedLabel: "GreenEarth",
  apiReleaseSha: "api-sha",
  preferences: {
    sourceWeights: {
      following: 0.3,
      networkLikes: 0.2,
      authorsTopics: 0.25,
      popular: 0.25,
    },
    freshness: 5,
    politics: 1,
    purpose: 0.5,
  },
  snapshot: {
    requestId: "request-1",
    feedName: "your-feed",
    generatedAt: "2026-07-27T18:42:10Z",
    storedItemCount: 30,
    displayedItemCount: 26,
    publiclyFilteredCount: 2,
    unavailableCount: 2,
  },
};

describe("feedback event payload", () => {
  it("uses PostHog survey response keys and compact snapshot context", () => {
    const payload = buildFeedbackEvent(submission, {
      surveyId: "survey-1",
      questionId: "question-1",
    });

    expect(payload).toEqual({
      event: "survey sent",
      distinct_id: "did:plc:user",
      properties: {
        $survey_id: "survey-1",
        $survey_submission_id: "feedback-submission-1",
        $survey_completed: true,
        "$survey_response_question-1": "Let me tune topic diversity.",
        feedback_submission_id: "feedback-submission-1",
        feedback_surface: "controls",
        feedback_context_key: "controls:your-feed",
        feed_name: "your-feed",
        feed_label: "GreenEarth",
        app_route: "/settings",
        api_release_sha: "api-sha",
        snapshot_context_available: true,
        source_following_weight: 0.3,
        source_network_likes_weight: 0.2,
        source_authors_topics_weight: 0.25,
        source_popular_weight: 0.25,
        freshness: 5,
        politics: 1,
        purpose: 0.5,
        feed_snapshot_id: "request-1",
        feed_generated_at: "2026-07-27T18:42:10Z",
        feed_stored_item_count: 30,
        feed_displayed_item_count: 26,
        feed_publicly_filtered_count: 2,
        feed_unavailable_count: 2,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("at://");
  });

  it("drops snapshot metadata when it belongs to a different selected feed", () => {
    const payload = buildFeedbackEvent(
      {
        ...submission,
        feedName: "random",
        feedLabel: "Random",
        apiReleaseSha: "random-api-sha",
      },
      { surveyId: "survey-1", questionId: "question-1" },
    );

    expect(payload.properties).toMatchObject({
      feed_name: "random",
      feed_label: "Random",
      feedback_context_key: "controls:random",
      snapshot_context_available: false,
    });
    expect(payload.properties).not.toHaveProperty("feed_snapshot_id");
    expect(payload.properties.api_release_sha).toBe("random-api-sha");
  });

  it("returns a preview without initializing PostHog in test mode", async () => {
    const analytics = {
      identify: vi.fn(),
      reset: vi.fn(),
      capture: vi.fn(),
    } as IAnalyticsService;
    const service = createFeedbackService(
      {
        environment: "stage",
        frontendReleaseSha: "stage-sha",
        posthog: { mode: "disabled" },
        feedback: { mode: "test" },
      },
      analytics,
    );

    const result = await service.submit(submission);

    expect(service.mode).toBe("test");
    expect(result.sent).toBe(false);
    expect(result.payload.properties.$survey_id).toBe("preview-controls-survey");
  });

  it("identifies once, captures the survey event, and resets on logout", async () => {
    const analytics = {
      identify: vi.fn(),
      reset: vi.fn(),
      capture: vi.fn(),
    } as IAnalyticsService;
    const surveys = {
      general: { surveyId: "s1", questionId: "q1" },
      controls: { surveyId: "s2", questionId: "q2" },
      howItWorks: { surveyId: "s3", questionId: "q3" },
    };
    const service = new PostHogFeedbackService(analytics, surveys);

    await service.submit(submission);
    await service.submit(submission);

    expect(analytics.identify).toHaveBeenCalledTimes(2);
    expect(analytics.identify).toHaveBeenCalledWith("did:plc:user");
    expect(analytics.capture).toHaveBeenCalledTimes(2);
    expect(analytics.capture).toHaveBeenCalledWith(
      "survey sent",
      expect.objectContaining({
        $survey_id: "s2",
        feedback_surface: "controls",
      }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  PostHogFeedbackService,
  buildFeedbackEvent,
  createFeedbackService,
  type PostHogClient,
} from "../services/feedback/feedback-service";
import type { FeedbackSubmission } from "../services/feedback/types";

const submission: FeedbackSubmission = {
  distinctId: "did:plc:user",
  surface: "controls",
  response: "Let me tune topic diversity.",
  appRoute: "/controls",
  preferences: {
    socialRadius: 3,
    freshness: 5,
    politics: 1,
    purpose: 0.5,
  },
  snapshot: {
    requestId: "request-1",
    feedName: "your-feed",
    generatedAt: "2026-07-27T18:42:10Z",
    apiReleaseSha: "api-sha",
    storedItemCount: 30,
    displayedItemCount: 26,
    publiclyFilteredCount: 2,
    unavailableCount: 2,
  },
};

describe("feedback event payload", () => {
  it("uses PostHog survey response keys and compact snapshot context", () => {
    const payload = buildFeedbackEvent(
      submission,
      { surveyId: "survey-1", questionId: "question-1" },
      "frontend-sha",
    );

    expect(payload).toEqual({
      event: "survey sent",
      distinct_id: "did:plc:user",
      properties: {
        $survey_id: "survey-1",
        "$survey_response_question-1": "Let me tune topic diversity.",
        feedback_surface: "controls",
        app_route: "/controls",
        frontend_release_sha: "frontend-sha",
        snapshot_context_available: true,
        social_radius: 3,
        freshness: 5,
        politics: 1,
        purpose: 0.5,
        feed_snapshot_id: "request-1",
        feed_name: "your-feed",
        feed_generated_at: "2026-07-27T18:42:10Z",
        api_release_sha: "api-sha",
        feed_stored_item_count: 30,
        feed_displayed_item_count: 26,
        feed_publicly_filtered_count: 2,
        feed_unavailable_count: 2,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("at://");
  });

  it("returns a preview without initializing PostHog in test mode", async () => {
    const service = await createFeedbackService({
      environment: "stage",
      frontendReleaseSha: "stage-sha",
      feedback: { mode: "test" },
    });

    const result = await service.submit(submission);

    expect(service.mode).toBe("test");
    expect(result.sent).toBe(false);
    expect(result.payload.properties.$survey_id).toBe(
      "preview-controls-survey",
    );
  });

  it("identifies once, captures the survey event, and resets on logout", async () => {
    const client: PostHogClient = {
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    const surveys = {
      general: { surveyId: "s1", questionId: "q1" },
      controls: { surveyId: "s2", questionId: "q2" },
      howItWorks: { surveyId: "s3", questionId: "q3" },
    };
    const service = new PostHogFeedbackService(client, surveys, "frontend-sha");

    await service.submit(submission);
    await service.submit(submission);
    service.reset();

    expect(client.identify).toHaveBeenCalledOnce();
    expect(client.identify).toHaveBeenCalledWith("did:plc:user");
    expect(client.capture).toHaveBeenCalledTimes(2);
    expect(client.capture).toHaveBeenCalledWith(
      "survey sent",
      expect.objectContaining({
        $survey_id: "s2",
        feedback_surface: "controls",
      }),
    );
    expect(client.reset).toHaveBeenCalledOnce();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PostHogFeedbackService,
  buildFeedbackEvent,
  createFeedbackService,
} from "../services/feedback/feedback-service";
import type { RuntimeConfig } from "../config/runtime-config";
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
      llm: 0,
    },
    freshness: 5,
    politics: 1,
    purpose: 0.5,
    authorPenalty: 0.7,
    topicPenalty: 0.7,
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

const config: RuntimeConfig = {
  environment: "production",
  frontendReleaseSha: "frontend-sha",
  posthog: { mode: "posthog", projectKey: "phc_project", host: "https://us.i.posthog.com/" },
  feedback: {
    mode: "posthog",
    surveys: { controls: { surveyId: "survey-1", questionId: "question-1" } },
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
        source_llm_weight: 0,
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
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = createFeedbackService({
      environment: "stage",
      frontendReleaseSha: "stage-sha",
      posthog: { mode: "disabled" },
      feedback: { mode: "test" },
    });

    const result = await service.submit(submission);

    expect(service.mode).toBe("test");
    expect(result.sent).toBe(false);
    expect(result.payload.properties.$survey_id).toBe("preview-controls-survey");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("confirmed feedback delivery", () => {
  it.each(["Ok", 1])("requires PostHog's positive acknowledgement (%s)", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status })));
    vi.stubGlobal("fetch", fetchMock);
    const service = createFeedbackService(config);

    await expect(service.submit(submission)).resolves.toMatchObject({ sent: true });

    expect(service).toBeInstanceOf(PostHogFeedbackService);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us.i.posthog.com/i/v0/e/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
      }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(options.body as string)).toEqual({
      api_key: "phc_project",
      ...buildFeedbackEvent(submission, { surveyId: "survey-1", questionId: "question-1" }),
      properties: expect.objectContaining({
        $survey_id: "survey-1",
        $survey_completed: true,
        "$survey_response_question-1": submission.response,
        feedback_submission_id: submission.submissionId,
        feedback_surface: "controls",
        surface: "greenearth_web",
        environment: "production",
        frontend_release_sha: "frontend-sha",
        schema_version: 1,
        app_route: "/settings",
        api_release_sha: "api-sha",
      }) as unknown,
    });
  });

  it("does not report success while the delivery receipt is pending", async () => {
    let acknowledge: (receipt: unknown) => void = () => {};
    const receipt = new Promise<unknown>((resolve) => {
      acknowledge = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => receipt }));
    const settled = vi.fn();
    const pending = createFeedbackService(config).submit(submission).then(settled);

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    acknowledge({ status: "Ok" });
    await pending;
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({ sent: true }));
  });

  it("preserves hostname filters without including URL tokens", async () => {
    window.location.hash = "#/auth/finish?token=private-oauth-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"Ok"}'));
    vi.stubGlobal("fetch", fetchMock);

    await createFeedbackService(config).submit(submission);

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(options.body as string)).toMatchObject({
      properties: {
        $host: window.location.host,
        $pathname: window.location.pathname,
        $current_url: `${window.location.origin}${window.location.pathname}#/settings`,
      },
    });
    expect(options.body).not.toContain("private-oauth-token");
  });

  it.each([400, 429, 503])("rejects HTTP %i without claiming delivery", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"status":"Ok"}', { status })));

    await expect(createFeedbackService(config).submit(submission)).rejects.toThrow(
      "We couldn't confirm your feedback was received.",
    );
  });

  it.each(["not JSON", "{}", "null", '{"status":0}', '{"status":"error"}', ""])(
    "rejects missing or invalid acknowledgements (%s)",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));

      await expect(createFeedbackService(config).submit(submission)).rejects.toThrow(
        "We couldn't confirm your feedback was received.",
      );
    },
  );

  it("rejects blocked or offline requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(createFeedbackService(config).submit(submission)).rejects.toThrow(
      "Check your connection or browser's tracking protection",
    );
  });

  it("aborts a stalled request and clears the timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const result = expect(createFeedbackService(config).submit(submission)).rejects.toThrow(
      "We couldn't confirm delivery in time.",
    );

    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps non-production feedback in no-network preview mode even with production keys", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = createFeedbackService({ ...config, environment: "stage" });

    await expect(service.submit(submission)).resolves.toMatchObject({ sent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when production capture is disabled or the survey is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const disabled = createFeedbackService({ ...config, posthog: { mode: "disabled" } });

    expect(disabled.mode).toBe("unavailable");
    await expect(disabled.submit(submission)).rejects.toThrow(
      "Feedback delivery is temporarily unavailable.",
    );
    await expect(
      createFeedbackService(config).submit({ ...submission, surface: "general" }),
    ).rejects.toThrow("Feedback is temporarily unavailable on this page.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ distinctId: "" }, { response: " " }])(
    "does not send invalid submissions (%j)",
    async (invalid) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createFeedbackService(config).submit({ ...submission, ...invalid }),
      ).rejects.toThrow("Sign in and enter your feedback before sending.");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

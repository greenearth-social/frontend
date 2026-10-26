import { describe, expect, it } from "vitest";
import { FeedApiError } from "../services/types";
import { describeLlmPromptError } from "../utils/llm-prompt-error";

describe("prompt error messages", () => {
  it.each([
    [["user"], "past six hours"],
    [["global"], "daily service limit"],
    [["user", "global"], "six-hour prompt limit and the daily service limit"],
  ])("explains quota scopes %j and the local retry time", (scopes, wording) => {
    const retry = new Date("2026-10-26T15:32:42Z");
    const failure = describeLlmPromptError(
      new FeedApiError(429, "limited", {
        detail: { scopes, retry_at: retry.toISOString() },
      }),
    );
    expect(failure.category).toBe("rate_limited");
    expect(failure.message).toContain(wording);
    expect(failure.message).toContain(
      retry.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }),
    );
  });

  it.each([
    { retry_after_seconds: 120 },
    { retry_at: "bad date", retry_after_seconds: 120 },
    { retry_after_seconds: -1 },
  ])("uses Retry-After when detail is missing or invalid: %j", (detail) => {
    const now = Date.parse("2026-10-26T15:30:00Z");
    const failure = describeLlmPromptError(
      new FeedApiError(429, "limited", {
        detail,
        retryAfterSeconds: 120,
      }),
      now,
    );
    expect(failure.message).toContain("Try again after");
    expect(failure.message).not.toContain("Invalid Date");
  });

  it("handles a rate limit with no retry metadata", () => {
    expect(describeLlmPromptError(new FeedApiError(429, "limited")).message).toContain(
      "Please try again later.",
    );
  });

  it.each([
    ["llm_query_vector_pool_too_small", "pool_too_small", "broader topic"],
    ["llm_query_vector_prompt_not_accepted", "prompt_not_accepted", "Prompt not accepted"],
  ])("distinguishes the typed 422 code %s", (code, category, wording) => {
    const failure = describeLlmPromptError(
      new FeedApiError(422, "internal diagnostics", {
        detail: { code, message: "internal diagnostics" },
      }),
    );
    expect(failure.category).toBe(category);
    expect(failure.message).toContain(wording);
    expect(failure.message).not.toContain("internal diagnostics");
  });

  it.each([undefined, null, [], [{ type: "too_long" }], "too few posts", { code: "unknown" }])(
    "does not mistake a validation or legacy 422 for insufficient posts: %j",
    (detail) => {
      expect(describeLlmPromptError(new FeedApiError(422, "validation", { detail }))).toEqual({
        category: "system",
        message: "Something went wrong. Please try again.",
      });
    },
  );

  it.each([new FeedApiError(502, "model credentials"), new TypeError("offline"), "unexpected"])(
    "keeps system diagnostics out of the message",
    (error) => {
      expect(describeLlmPromptError(error)).toEqual({
        category: "system",
        message: "Something went wrong. Please try again.",
      });
    },
  );
});

import { FeedApiError } from "../services/types";

export interface LlmPromptFailure {
  category: "rate_limited" | "pool_too_small" | "prompt_not_accepted" | "prompt_changed" | "system";
  message: string;
}

export function describeLlmPromptError(error: unknown, now = Date.now()): LlmPromptFailure {
  const detail =
    error instanceof FeedApiError &&
    typeof error.detail === "object" &&
    error.detail !== null &&
    !Array.isArray(error.detail)
      ? (error.detail as Record<string, unknown>)
      : {};
  if (
    error instanceof FeedApiError &&
    error.status === 409 &&
    detail.code === "llm_query_vector_prompt_changed"
  ) {
    return {
      category: "prompt_changed",
      message:
        "Your prompt changed in another session. Settings have been refreshed. Please try again.",
    };
  }
  if (error instanceof FeedApiError && error.status === 429) {
    const scopes = Array.isArray(detail.scopes) ? detail.scopes : [];
    const user = scopes.includes("user");
    const global = scopes.includes("global");
    const limit =
      user && global
        ? "Your six-hour prompt limit and the daily service limit have been reached."
        : user
          ? "You’ve reached your prompt limit for the past six hours."
          : global
            ? "Prompt generation has reached its daily service limit."
            : "Prompt generation is temporarily rate limited.";
    const retryAt = typeof detail.retry_at === "string" ? Date.parse(detail.retry_at) : NaN;
    const seconds =
      typeof detail.retry_after_seconds === "number" &&
      Number.isFinite(detail.retry_after_seconds) &&
      detail.retry_after_seconds >= 0
        ? detail.retry_after_seconds
        : error.retryAfterSeconds;
    const retryTime = Number.isFinite(retryAt)
      ? retryAt
      : seconds !== undefined
        ? now + seconds * 1000
        : NaN;
    const date = new Date(retryTime);
    const retry = Number.isFinite(date.getTime())
      ? `Try again after ${date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })}.`
      : "Please try again later.";
    return { category: "rate_limited", message: `${limit} ${retry}` };
  }
  if (error instanceof FeedApiError && error.status === 422) {
    if (detail.code === "llm_query_vector_pool_too_small") {
      return {
        category: "pool_too_small",
        message:
          "We couldn’t find enough relevant posts for this prompt. Try a broader topic or different wording.",
      };
    }
    if (detail.code === "llm_query_vector_prompt_not_accepted") {
      return {
        category: "prompt_not_accepted",
        message: "Prompt not accepted. Please rephrase your request and try again.",
      };
    }
  }
  return { category: "system", message: "Something went wrong. Please try again." };
}

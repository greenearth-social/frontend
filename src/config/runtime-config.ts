export type FeedbackSurface = "general" | "controls" | "howItWorks";

export interface SurveyRuntimeConfig {
  surveyId: string;
  questionId: string;
}

export type FeedbackRuntimeConfig =
  | {
      mode: "test";
    }
  | {
      mode: "posthog";
      surveys: Partial<Record<FeedbackSurface, SurveyRuntimeConfig>>;
    }
  | {
      mode: "unavailable";
      reason: string;
    };

export type PostHogRuntimeConfig =
  | {
      mode: "disabled";
    }
  | {
      mode: "posthog";
      projectKey: string;
      host: string;
    };

export interface RuntimeConfig {
  environment: string;
  firestoreDatabase?: string;
  frontendReleaseSha: string | null;
  posthog: PostHogRuntimeConfig;
  feedback: FeedbackRuntimeConfig;
  blueskyUrls?: Partial<Record<"your-feed" | "best-of-friends" | "random", string>>;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  environment: "local",
  frontendReleaseSha: null,
  posthog: { mode: "disabled" },
  feedback: { mode: "test" },
};

const RUNTIME_CONFIG_TIMEOUT_MS = 5_000;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseSurvey(value: unknown): SurveyRuntimeConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const surveyId = nonEmptyString(candidate.surveyId);
  const questionId = nonEmptyString(candidate.questionId);
  return surveyId && questionId ? { surveyId, questionId } : null;
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== "object" || value === null) return DEFAULT_RUNTIME_CONFIG;
  const candidate = value as Record<string, unknown>;
  const environment = nonEmptyString(candidate.environment) ?? "local";
  const frontendReleaseSha = nonEmptyString(candidate.frontendReleaseSha);
  const firestoreDatabase = nonEmptyString(candidate.firestoreDatabase) ?? undefined;
  const rawBlueskyUrls =
    typeof candidate.blueskyUrls === "object" && candidate.blueskyUrls !== null
      ? (candidate.blueskyUrls as Record<string, unknown>)
      : null;
  const yourFeedUrl = nonEmptyString(rawBlueskyUrls?.["your-feed"]);
  const bestOfFriendsUrl = nonEmptyString(rawBlueskyUrls?.["best-of-friends"]);
  const randomUrl = nonEmptyString(rawBlueskyUrls?.random);
  const blueskyUrls = rawBlueskyUrls
    ? {
        ...(yourFeedUrl ? { "your-feed": yourFeedUrl } : {}),
        ...(bestOfFriendsUrl ? { "best-of-friends": bestOfFriendsUrl } : {}),
        ...(randomUrl ? { random: randomUrl } : {}),
      }
    : undefined;
  const rawFeedback =
    typeof candidate.feedback === "object" && candidate.feedback !== null
      ? (candidate.feedback as Record<string, unknown>)
      : null;

  let posthog: PostHogRuntimeConfig = { mode: "disabled" };
  let feedback: FeedbackRuntimeConfig = { mode: "test" };
  if (rawFeedback?.mode === "posthog") {
    const projectKey = nonEmptyString(rawFeedback.projectKey);
    const host = nonEmptyString(rawFeedback.host);
    if (environment === "production" && projectKey && host) {
      posthog = { mode: "posthog", projectKey, host };
    }
    const rawSurveys =
      typeof rawFeedback.surveys === "object" && rawFeedback.surveys !== null
        ? (rawFeedback.surveys as Record<string, unknown>)
        : null;
    const general = parseSurvey(rawSurveys?.general);
    const controls = parseSurvey(rawSurveys?.controls);
    const howItWorks = parseSurvey(rawSurveys?.howItWorks);
    if (projectKey && host) {
      feedback = {
        mode: "posthog",
        surveys: {
          ...(general ? { general } : {}),
          ...(controls ? { controls } : {}),
          ...(howItWorks ? { howItWorks } : {}),
        },
      };
    } else {
      feedback = {
        mode: "unavailable",
        reason: "Production feedback configuration is incomplete.",
      };
    }
  } else if (rawFeedback?.mode === "unavailable") {
    feedback = {
      mode: "unavailable",
      reason:
        nonEmptyString(rawFeedback.reason) ?? "Feedback is temporarily unavailable.",
    };
  }

  return {
    environment,
    ...(firestoreDatabase ? { firestoreDatabase } : {}),
    frontendReleaseSha,
    posthog,
    feedback,
    ...(blueskyUrls ? { blueskyUrls } : {}),
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, RUNTIME_CONFIG_TIMEOUT_MS);

  try {
    const response = await fetch("/config.json", { signal: controller.signal });
    if (!response.ok) return DEFAULT_RUNTIME_CONFIG;
    return parseRuntimeConfig(await response.json());
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  } finally {
    clearTimeout(timeout);
  }
}

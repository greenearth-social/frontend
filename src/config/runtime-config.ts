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
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  environment: "local",
  frontendReleaseSha: null,
  posthog: { mode: "disabled" },
  feedback: { mode: "test" },
};

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
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("/config.json");
    if (!response.ok) return DEFAULT_RUNTIME_CONFIG;
    return parseRuntimeConfig(await response.json());
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  }
}

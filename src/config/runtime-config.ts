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
      projectKey: string;
      host: string;
      surveys: Record<FeedbackSurface, SurveyRuntimeConfig>;
    }
  | {
      mode: "unavailable";
      reason: string;
    };

export interface RuntimeConfig {
  environment: string;
  firestoreDatabase?: string;
  frontendReleaseSha: string | null;
  feedback: FeedbackRuntimeConfig;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  environment: "local",
  frontendReleaseSha: null,
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

  let feedback: FeedbackRuntimeConfig = { mode: "test" };
  if (rawFeedback?.mode === "posthog") {
    const projectKey = nonEmptyString(rawFeedback.projectKey);
    const host = nonEmptyString(rawFeedback.host);
    const rawSurveys =
      typeof rawFeedback.surveys === "object" && rawFeedback.surveys !== null
        ? (rawFeedback.surveys as Record<string, unknown>)
        : null;
    const general = parseSurvey(rawSurveys?.general);
    const controls = parseSurvey(rawSurveys?.controls);
    const howItWorks = parseSurvey(rawSurveys?.howItWorks);
    feedback =
      projectKey && host && general && controls && howItWorks
        ? {
            mode: "posthog",
            projectKey,
            host,
            surveys: { general, controls, howItWorks },
          }
        : {
            mode: "unavailable",
            reason: "Production feedback configuration is incomplete.",
          };
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

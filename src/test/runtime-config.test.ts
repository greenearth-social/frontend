import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../config/runtime-config";

describe("parseRuntimeConfig", () => {
  it("defaults missing feedback configuration to no-network test mode", () => {
    expect(
      parseRuntimeConfig({
        environment: "stage",
        firestoreDatabase: "greenearth-stage",
      }),
    ).toEqual({
      environment: "stage",
      firestoreDatabase: "greenearth-stage",
      frontendReleaseSha: null,
      feedback: { mode: "test" },
    });
  });

  it("accepts complete production PostHog configuration", () => {
    const config = parseRuntimeConfig({
      environment: "production",
      frontendReleaseSha: "frontend-sha",
      feedback: {
        mode: "posthog",
        projectKey: "phc_project",
        host: "https://us.i.posthog.com",
        surveys: {
          general: { surveyId: "s1", questionId: "q1" },
          controls: { surveyId: "s2", questionId: "q2" },
          howItWorks: { surveyId: "s3", questionId: "q3" },
        },
      },
    });

    expect(config.feedback).toMatchObject({
      mode: "posthog",
      projectKey: "phc_project",
    });
  });

  it("fails closed when production survey configuration is incomplete", () => {
    const config = parseRuntimeConfig({
      environment: "production",
      feedback: {
        mode: "posthog",
        projectKey: "phc_project",
        host: "https://us.i.posthog.com",
        surveys: {},
      },
    });

    expect(config.feedback.mode).toBe("unavailable");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runtimeConfig as defaultRuntimeConfig } from "../config";
import {
  loadRuntimeConfig,
  parseRuntimeConfig,
} from "../config/runtime-config";

const productionRuntimeConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/config.prod.json"), "utf8"),
) as unknown;

const expectedProductionBlueskyUrls = {
  "your-feed": "https://bsky.app/profile/mysky.social/feed/your-feed",
  "best-of-friends": "https://bsky.app/profile/mysky.social/feed/best-of-friends",
  random: "https://bsky.app/profile/mysky.social/feed/random",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseRuntimeConfig", () => {
  it("routes every production feed to its published Bluesky record", () => {
    expect(defaultRuntimeConfig.blueskyUrls).toEqual(expectedProductionBlueskyUrls);
    expect(parseRuntimeConfig(productionRuntimeConfig).blueskyUrls).toEqual(
      expectedProductionBlueskyUrls,
    );
  });

  it("defaults missing feedback configuration to no-network test mode", () => {
    expect(
      parseRuntimeConfig({
        environment: "stage",
        firestoreDatabase: "greenearth-stage",
        blueskyUrls: {
          "your-feed": "https://example.test/your-feed",
          random: "https://example.test/random",
        },
      }),
    ).toEqual({
      environment: "stage",
      firestoreDatabase: "greenearth-stage",
      frontendReleaseSha: null,
      posthog: { mode: "disabled" },
      feedback: { mode: "test" },
      blueskyUrls: {
        "your-feed": "https://example.test/your-feed",
        random: "https://example.test/random",
      },
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
    });
    expect(config.posthog).toEqual({
      mode: "posthog",
      projectKey: "phc_project",
      host: "https://us.i.posthog.com",
    });
  });

  it("keeps analytics enabled when production survey configuration is incomplete", () => {
    const config = parseRuntimeConfig({
      environment: "production",
      feedback: {
        mode: "posthog",
        projectKey: "phc_project",
        host: "https://us.i.posthog.com",
        surveys: {},
      },
    });

    expect(config.feedback).toEqual({ mode: "posthog", surveys: {} });
    expect(config.posthog.mode).toBe("posthog");
  });

  it("disables PostHog outside production even when keys are present", () => {
    const config = parseRuntimeConfig({
      environment: "stage",
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

    expect(config.posthog.mode).toBe("disabled");
  });

  it("falls back when the runtime config request stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const configPromise = loadRuntimeConfig();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(configPromise).resolves.toMatchObject({
      environment: "local",
      posthog: { mode: "disabled" },
      feedback: { mode: "test" },
    });
  });
});

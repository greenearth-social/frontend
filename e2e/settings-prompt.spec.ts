import { expect, test, type Page } from "@playwright/test";
import type { RootStore } from "../src/stores/root-store";

async function openSettings(page: Page): Promise<void> {
  await page.goto("/#/auth/finish?token=test-token", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/#\/feed(?:\/your-feed)?$/);
  await page.evaluate(() => {
    window.location.hash = "/settings/your-feed";
  });
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toBeVisible();
}

async function preparePrompt(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mainPath = "/src/main.ts";
    const typesPath = "/src/services/types.ts";
    const app = (await import(mainPath)) as { getRootStore(): RootStore | null };
    const types = (await import(typesPath)) as typeof import("../src/services/types");
    const root = app.getRootStore();
    if (!root) throw new Error("Expected root store");
    // Includes line breaks, a long token, and text that must be escaped.
    root.preferencesStore.llmPrompt = {
      promptKey: "old",
      prompt: `Hopeful science\n${"topic".repeat(110)} <script>plain text</script>`,
      createdAt: "2026-10-25T10:00:00Z",
    };
    root.services.feedApiService.fitLlmPrompt = (prompt) =>
      new Promise((resolve, reject) => {
        const state = window as typeof window & { finishPrompt?: (failure?: boolean) => void };
        state.finishPrompt = (failure = false) => {
          if (failure) {
            reject(
              new types.FeedApiError(429, "private backend diagnostics", {
                detail: { scopes: ["user", "global"], retry_after_seconds: 300 },
              }),
            );
          } else {
            resolve({ promptKey: "new", prompt, createdAt: "2026-10-25T11:00:00Z" });
          }
        };
      });
  });
}

async function finishPrompt(page: Page, failure = false): Promise<void> {
  await page.evaluate((failed) => {
    const state = window as typeof window & { finishPrompt?: (failure?: boolean) => void };
    if (!state.finishPrompt) throw new Error("No pending prompt");
    state.finishPrompt(failed);
  }, failure);
}

async function useHttpPromptService(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mainPath = "/src/main.ts";
    const apiPath = "/src/services/api/feed-api-service.ts";
    const app = (await import(mainPath)) as { getRootStore(): RootStore | null };
    const { FeedApiService } = (await import(
      apiPath
    )) as typeof import("../src/services/api/feed-api-service");
    const service = app.getRootStore()?.services.feedApiService;
    if (!service) throw new Error("Expected service");
    const api = new FeedApiService("", () => Promise.resolve("test-token"));
    service.fitLlmPrompt = api.fitLlmPrompt.bind(api);
    service.removeLlmPrompt = api.removeLlmPrompt.bind(api);
    service.getLlmPrompt = api.getLlmPrompt.bind(api);
    service.getPreferences = api.getPreferences.bind(api);
  });
}

for (const width of [320, 375, 768, 1280]) {
  test(`prompt state, loading and toast layout at ${String(width)}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openSettings(page);
    await preparePrompt(page);
    const card = page.locator("settings-page .prompt-card");
    const input = page.getByRole("textbox", { name: "Prompt", exact: true });
    await expect(card.locator(".active-prompt-text")).toContainText("Hopeful science");
    await expect(input).toHaveValue("");
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(card.locator("script")).toHaveCount(0);
    const text = card.locator(".active-prompt-text");
    await expect(page.getByRole("button", { name: "Show more", exact: true })).toBeVisible();
    const collapsed = await text.boundingBox();
    await page.getByRole("button", { name: "Show more", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show less", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect((await text.boundingBox())?.height).toBeGreaterThan(collapsed?.height ?? 0);
    await page.getByRole("button", { name: "Show less", exact: true }).click();
    await expect(text).not.toHaveClass(/expanded/);
    const inputBox = await input.boundingBox();
    const composer = await card.locator(".prompt-composer").boundingBox();
    expect(inputBox?.width).toBeGreaterThanOrEqual((composer?.width ?? 0) - 2);
    const before = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
    expect(before?.y).toBeGreaterThanOrEqual((inputBox?.y ?? 0) + (inputBox?.height ?? 0) - 1);
    expect(before?.height).toBeGreaterThanOrEqual(44);
    expect(await input.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
    await input.fill("New science prompt");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const thinking = page.getByRole("button", { name: "Thinking…", exact: true });
    await expect(thinking).toBeDisabled();
    await expect(input).toBeDisabled();
    await expect(card).toHaveAttribute("aria-busy", "true");
    const during = await thinking.boundingBox();
    expect(during?.width).toBe(before?.width);
    expect(during?.height).toBe(before?.height);
    const border = await card.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { animation: style.animationName, pointerEvents: style.pointerEvents };
    });
    expect(border).toEqual({ animation: "prompt-light", pointerEvents: "none" });
    const angle = await card.evaluate((element) =>
      getComputedStyle(element, "::after").getPropertyValue("--prompt-light-angle"),
    );
    await expect
      .poll(async () =>
        card.evaluate((element) =>
          getComputedStyle(element, "::after").getPropertyValue("--prompt-light-angle"),
        ),
      )
      .not.toBe(angle);
    await page.screenshot({ path: testInfo.outputPath("prompt-thinking.png") });
    await finishPrompt(page);
    await expect(input).toHaveValue("");
    await expect(card.locator(".active-prompt-text")).toHaveText("New science prompt");
    await expect(page.getByRole("button", { name: "Show more", exact: true })).toHaveCount(0);
    await expect(card).toHaveAttribute("aria-busy", "false");
    await input.fill("Failed replacement");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await finishPrompt(page, true);
    const toast = page.locator("settings-page .prompt-toast");
    await expect(toast).toContainText("six-hour prompt limit and the daily service limit");
    await expect(toast).toContainText("Try again after");
    await expect(toast).not.toContainText("private backend diagnostics");
    await expect(input).toHaveValue("Failed replacement");
    await expect(card.locator(".active-prompt-text")).toHaveText("New science prompt");
    expect(await toast.evaluate((element) => element.closest(".prompt-card") === null)).toBe(true);
    const bounds = await toast.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(900);
    await page.screenshot({ path: testInfo.outputPath("prompt-error.png") });
    await page.getByRole("button", { name: "Dismiss prompt error" }).click();
    await expect(toast).toHaveCount(0);
  });
}

test("reduced motion uses a static loading border", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSettings(page);
  await preparePrompt(page);
  await page.getByRole("textbox", { name: "Prompt", exact: true }).fill("A new prompt");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const card = page.locator("settings-page .prompt-card");
  await expect(card).toHaveAttribute("aria-busy", "true");
  expect(await card.evaluate((element) => getComputedStyle(element, "::after").animationName)).toBe(
    "none",
  );
  await finishPrompt(page);
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue("");
});

for (const failure of [
  {
    name: "insufficient posts",
    status: 422,
    detail: { code: "llm_query_vector_pool_too_small" },
    message: "broader topic",
  },
  {
    name: "Claude refusal",
    status: 422,
    detail: { code: "llm_query_vector_prompt_not_accepted" },
    message: "Prompt not accepted",
  },
  {
    name: "rate limit",
    status: 429,
    detail: { code: "llm_query_vector_rate_limited", scopes: ["user"], retry_after_seconds: 120 },
    message: "past six hours",
  },
  {
    name: "server error",
    status: 502,
    detail: "private diagnostics",
    message: "Something went wrong",
  },
]) {
  test(`HTTP ${failure.name} reaches a dismissible toast`, async ({ page }) => {
    await page.route("**/api/feeds/llm-query-vectors/fit", async (route) => {
      await route.fulfill({ status: failure.status, json: { detail: failure.detail } });
    });
    await openSettings(page);
    await useHttpPromptService(page);
    await page.getByRole("textbox", { name: "Prompt", exact: true }).fill("original query");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const toast = page.locator("settings-page .prompt-toast");
    await expect(toast).toContainText(failure.message);
    await expect(toast).not.toContainText("private diagnostics");
    await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
      "original query",
    );
    await page.getByRole("button", { name: "Dismiss prompt error" }).click();
    await expect(toast).toHaveCount(0);
  });
}

test("HTTP removal preserves the draft and survives leaving and reopening Settings", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/feeds/llm-query-vectors/current?*", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    expect(new URL(route.request().url()).searchParams.get("prompt_key")).toBe("old");
    await released;
    await route.fulfill({
      json: {
        source_weights: {
          following: 0.3,
          network_likes: 0.2,
          authors_topics: 0.25,
          popular: 0.25,
          llm: 0,
        },
      },
    });
  });
  await openSettings(page);
  await preparePrompt(page);
  await useHttpPromptService(page);
  const input = page.getByRole("textbox", { name: "Prompt", exact: true });
  await input.fill("unsent draft");
  await page.getByRole("button", { name: "Remove active prompt" }).click();
  await expect(page.getByRole("button", { name: "Remove active prompt" })).toHaveText("Removing…");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reset settings to defaults", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.locator(".active-prompt")).toHaveCount(0);
  await expect(input).toHaveValue("unsent draft");
  await expect(page.getByRole("slider", { name: "Prompt amount", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("prompt-removed-mobile.png") });
  await page.evaluate(() => {
    window.location.hash = "/feed/your-feed";
  });
  await expect(page.locator("settings-page")).toHaveCount(0);
  await page.evaluate(() => {
    window.location.hash = "/settings/your-feed";
  });
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toBeVisible();
  await expect(page.locator(".active-prompt")).toHaveCount(0);
});

test("HTTP removal failure keeps the saved prompt and draft", async ({ page }) => {
  await page.route("**/api/feeds/llm-query-vectors/current?*", async (route) => {
    await route.fulfill({ status: 503, json: { detail: "internal storage diagnostics" } });
  });
  await openSettings(page);
  await preparePrompt(page);
  await useHttpPromptService(page);
  await page.getByRole("textbox", { name: "Prompt", exact: true }).fill("unsent draft");
  await page.getByRole("button", { name: "Remove active prompt" }).click();
  await expect(page.locator(".prompt-toast")).toContainText("We couldn’t remove your prompt");
  await expect(page.locator(".active-prompt-text")).toContainText("Hopeful science");
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
    "unsent draft",
  );
});

test("HTTP removal conflict refreshes the prompt and preserves the unsent draft", async ({
  page,
}) => {
  await page.route("**/api/feeds/llm-query-vectors/current?*", async (route) => {
    await route.fulfill({
      status: 409,
      json: { detail: { code: "llm_query_vector_prompt_changed" } },
    });
  });
  await page.route("**/api/feeds/llm-query-vectors/current", async (route) => {
    await route.fulfill({
      json: {
        prompt_key: "newer",
        prompt: "saved in another session",
        created_at: "2026-10-25T12:00:00Z",
      },
    });
  });
  await page.route("**/api/feeds/preferences", async (route) => {
    await route.fulfill({
      json: {
        feeds: {
          "your-feed": {
            source_weights: {
              following: 0.24,
              network_likes: 0.16,
              authors_topics: 0.2,
              popular: 0.2,
              llm: 0.2,
            },
          },
        },
      },
    });
  });
  await openSettings(page);
  await preparePrompt(page);
  await useHttpPromptService(page);
  await page.getByRole("textbox", { name: "Prompt", exact: true }).fill("unsent draft");
  await page.getByRole("button", { name: "Remove active prompt" }).click();
  await expect(page.locator(".prompt-toast")).toContainText("Settings have been refreshed");
  await expect(page.locator(".active-prompt-text")).toHaveText("saved in another session");
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
    "unsent draft",
  );
});

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

for (const width of [375, 1280]) {
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
    const before = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
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

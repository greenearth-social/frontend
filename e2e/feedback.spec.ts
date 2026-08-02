import { expect, test } from "@playwright/test";

test("previews feedback without contacting PostHog in local test mode", async ({
  page,
}) => {
  const postHogRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("posthog")) postHogRequests.push(request.url());
  });

  await page.goto("/#/auth/finish?token=test-token");
  await page.waitForSelector("feed-item-card");
  await page.goto("/#/feedback");

  const form = page.locator("feedback-form");
  await form.locator("textarea").fill("Please add more topic controls.");
  await form.getByRole("button", { name: "Submit" }).click();

  await expect(form).toContainText(
    "Test mode: this feedback was not sent to PostHog.",
  );
  await form.getByText("Preview PostHog payload").click();
  await expect(form.locator("pre")).toContainText('"event": "survey sent"');
  await expect(form.locator("pre")).toContainText(
    '"feed_snapshot_id": "abc123-def456-ghi789"',
  );
  await expect(form.locator("pre")).toContainText('"feed_name": "your-feed"');
  await expect(form.locator("pre")).toContainText(
    '"feedback_context_key": "general:your-feed"',
  );
  await expect(form.locator("pre")).toContainText('"feedback_submission_id":');
  expect(postHogRequests).toEqual([]);
});

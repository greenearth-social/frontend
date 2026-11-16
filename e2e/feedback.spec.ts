import { expect, test } from "@playwright/test";

test("confirms feedback delivery and keeps a failed message available for retry", async ({
  page,
}) => {
  await page.route("**/config.json", (route) =>
    route.fulfill({
      json: {
        environment: "production",
        frontendReleaseSha: "test-sha",
        feedback: {
          mode: "posthog",
          projectKey: "phc_test_project",
          host: "https://posthog.example.invalid",
          surveys: { general: { surveyId: "survey-1", questionId: "question-1" } },
        },
      },
    }),
  );
  let failFirstDelivery: () => void = () => {};
  const firstDelivery = new Promise<void>((resolve) => {
    failFirstDelivery = resolve;
  });
  const submissions: Record<string, unknown>[] = [];
  await page.route("https://posthog.example.invalid/**", async (route) => {
    const request = route.request();
    // SDK product events may be compressed; only the explicit feedback request is JSON.
    if (request.headers()["content-type"] === "application/json") {
      const body = request.postDataJSON() as Record<string, unknown>;
      if (body.event === "survey sent") {
        submissions.push(body);
        if (submissions.length === 1) {
          await firstDelivery;
          await route.fulfill({ status: 503, json: { status: "error" } });
          return;
        }
      }
    }
    await route.fulfill({ json: { status: "Ok" } });
  });

  await page.goto("/#/auth/finish?token=test-token");
  await page.waitForSelector("feed-item-card");
  await page.goto("/#/feedback");
  const form = page.locator("feedback-form");
  const textarea = form.locator("textarea");
  await textarea.fill("Please keep my feedback until it is received.");
  await form.getByRole("button", { name: "Submit" }).click();

  await expect(form.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await expect(textarea).toHaveValue("Please keep my feedback until it is received.");
  await expect(form).not.toContainText("Thanks for your feedback!");
  failFirstDelivery();
  await expect(form.getByRole("alert")).toContainText(
    "We couldn't confirm your feedback was received.",
  );
  await expect(textarea).toHaveValue("Please keep my feedback until it is received.");

  await form.getByRole("button", { name: "Submit" }).click();
  await expect(form).toContainText("Thanks for your feedback!");
  await expect(textarea).toHaveValue("");
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toMatchObject({
    event: "survey sent",
    distinct_id: "mock-user-1",
    properties: {
      $survey_id: "survey-1",
      $survey_completed: true,
      "$survey_response_question-1": "Please keep my feedback until it is received.",
      surface: "greenearth_web",
      environment: "production",
    },
  });
});

test("previews feedback without contacting PostHog in local test mode", async ({ page }) => {
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

  await expect(form).toContainText("Test mode: this feedback was not sent to PostHog.");
  await form.getByText("Preview PostHog payload").click();
  await expect(form.locator("pre")).toContainText('"event": "survey sent"');
  await expect(form.locator("pre")).toContainText('"feed_snapshot_id": "abc123-def456-ghi789"');
  await expect(form.locator("pre")).toContainText('"feed_name": "your-feed"');
  await expect(form.locator("pre")).toContainText('"feedback_context_key": "general:your-feed"');
  await expect(form.locator("pre")).toContainText('"feedback_submission_id":');
  expect(postHogRequests).toEqual([]);

  for (const feed of ["your-feed", "best-of-friends", "random"]) {
    for (const surface of ["settings", "feedback"]) {
      await page.goto(`/#/${surface}/${feed}`);
      await expect(page.locator("feedback-form textarea")).toHaveAttribute(
        "placeholder",
        "Questions? Feature requests? We will reply by DM on BlueSky, or include your email.",
      );
    }
  }
});

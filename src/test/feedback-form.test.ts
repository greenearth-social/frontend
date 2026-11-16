import { beforeEach, describe, expect, it, vi } from "vitest";

const payload = {
  event: "survey sent" as const,
  distinct_id: "did:plc:test-user",
  properties: {
    $survey_id: "preview-general-survey",
    $survey_response_preview: "Useful feedback",
  },
};

const testState = vi.hoisted(() => ({
  rootStore: {
    feedbackStore: {
      mode: "test" as const,
      unavailableReason: null,
      unavailableReasonFor: vi.fn().mockReturnValue(null),
      submit: vi.fn(),
    },
  },
}));

vi.mock("../main", () => ({
  getRootStore: () => testState.rootStore,
}));

import "../components/feedback-form";

describe("FeedbackForm", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    testState.rootStore.feedbackStore.submit.mockReset();
    testState.rootStore.feedbackStore.submit.mockResolvedValue({
      sent: false,
      payload,
    });
  });

  it("shows a no-network PostHog payload preview in test mode", async () => {
    const element = document.createElement("feedback-form");
    element.prompt = "We'd love to know what you think of GreenEarth";
    document.body.appendChild(element);
    await element.updateComplete;

    const textarea = element.shadowRoot?.querySelector("textarea");
    if (!textarea) throw new Error("Feedback textarea did not render");
    textarea.value = "Useful feedback";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();

    await vi.waitFor(() => {
      expect(testState.rootStore.feedbackStore.submit).toHaveBeenCalledWith(
        "general",
        "Useful feedback",
        "your-feed",
      );
    });
    await element.updateComplete;

    expect(element.shadowRoot?.textContent).toContain(
      "Test mode: this feedback was not sent to PostHog.",
    );
    expect(element.shadowRoot?.querySelector("pre")?.textContent).toContain(
      "preview-general-survey",
    );
    expect(textarea.value).toBe("");
  });

  it("keeps the form pending until delivery is confirmed and prevents duplicate submits", async () => {
    let confirm: (result: { sent: boolean; payload: typeof payload }) => void = () => {};
    testState.rootStore.feedbackStore.submit.mockReturnValue(
      new Promise((resolve) => {
        confirm = resolve;
      }),
    );
    const element = document.createElement("feedback-form");
    document.body.appendChild(element);
    await element.updateComplete;
    const shadow = element.shadowRoot;
    const textarea = shadow?.querySelector("textarea");
    const form = shadow?.querySelector("form");
    if (!shadow || !textarea || !form) throw new Error("Feedback form did not render");
    textarea.value = "Useful feedback";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await element.updateComplete;

    expect(testState.rootStore.feedbackStore.submit).toHaveBeenCalledOnce();
    expect(shadow.textContent).toContain("Sending…");
    expect(shadow.textContent).not.toContain("Thanks for your feedback!");
    expect(textarea.value).toBe("Useful feedback");
    expect(textarea.disabled).toBe(true);

    confirm({ sent: true, payload });
    await vi.waitFor(() => {
      expect(shadow.textContent).toContain("Thanks for your feedback!");
    });
    expect(textarea.value).toBe("");
    expect(textarea.disabled).toBe(false);
  });

  it("preserves feedback after delivery fails and allows a successful retry", async () => {
    const message = "We couldn't confirm your feedback was received. Please try again.";
    testState.rootStore.feedbackStore.submit
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValueOnce({ sent: true, payload });
    const element = document.createElement("feedback-form");
    document.body.appendChild(element);
    await element.updateComplete;
    const shadow = element.shadowRoot;
    const textarea = shadow?.querySelector("textarea");
    const button = shadow?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!shadow || !textarea || !button) throw new Error("Feedback form did not render");
    textarea.value = "Please keep this message";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await element.updateComplete;

    button.click();
    await vi.waitFor(() => {
      expect(shadow.querySelector('[role="alert"]')?.textContent).toContain(message);
    });
    expect(shadow.textContent).not.toContain("Thanks for your feedback!");
    expect(textarea.value).toBe("Please keep this message");
    expect(button.disabled).toBe(false);

    button.click();
    await vi.waitFor(() => {
      expect(shadow.textContent).toContain("Thanks for your feedback!");
    });
    expect(testState.rootStore.feedbackStore.submit).toHaveBeenNthCalledWith(
      2,
      "general",
      "Please keep this message",
      "your-feed",
    );
    expect(textarea.value).toBe("");
    expect(shadow.querySelector('[role="alert"]')).toBeNull();
  });
});

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
});

import { describe, expect, it, vi } from "vitest";
import type { FeedbackSubmission } from "../services/feedback/types";
import type { RootStore } from "../stores/root-store";
import { FeedbackStore } from "../stores/feedback-store";

function makeRoot(currentRequestId: string | null) {
  const submit = vi.fn().mockResolvedValue({ sent: true, payload: {} });
  const root = {
    authStore: { currentUser: { uid: "did:plc:alice" } },
    feedStore: {
      currentRequestId,
      currentApiReleaseSha: "api-sha",
      feedList: [
        {
          requestId: "greenearth-request",
          feedName: "your-feed",
          generatedAt: "2026-08-01T10:00:00Z",
        },
        {
          requestId: "friends-request",
          feedName: "best-of-friends",
          generatedAt: "2026-08-01T11:00:00Z",
        },
      ],
      filteringCountsByRequest: {
        "friends-request": {
          storedItemCount: 30,
          displayedItemCount: 25,
          publiclyFilteredCount: 3,
          unavailableCount: 2,
        },
      },
    },
    preferencesStore: {
      values: { socialRadius: 3, freshness: 5, politics: 1, purpose: 0.5 },
    },
    services: {
      feedbackService: {
        mode: "test",
        unavailableReason: null,
        unavailableReasonFor: vi.fn().mockReturnValue(null),
        submit,
      },
    },
  } as unknown as RootStore;
  return { root, submit };
}

describe("FeedbackStore", () => {
  it("sends the explicit selected feed with its matching snapshot", async () => {
    window.location.hash = "/controls";
    const { root, submit } = makeRoot("friends-request");

    await new FeedbackStore(root).submit(
      "controls",
      "Let me tune this feed.",
      "best-of-friends",
    );

    const sent = submit.mock.calls[0]?.[0] as unknown as FeedbackSubmission;
    expect(sent).toMatchObject({
      distinctId: "did:plc:alice",
      surface: "controls",
      appRoute: "/controls",
      feedName: "best-of-friends",
      feedLabel: "Best of Friends",
      snapshot: {
        requestId: "friends-request",
        feedName: "best-of-friends",
        apiReleaseSha: "api-sha",
      },
    });
    expect(sent.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not attach the current snapshot when another feed is selected", async () => {
    const { root, submit } = makeRoot("greenearth-request");

    await new FeedbackStore(root).submit(
      "general",
      "Random feedback.",
      "random",
    );

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        feedName: "random",
        feedLabel: "Random",
        snapshot: null,
      }),
    );
  });
});

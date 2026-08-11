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
          apiReleaseSha: "greenearth-api-sha",
        },
        {
          requestId: "friends-request",
          feedName: "best-of-friends",
          generatedAt: "2026-08-01T11:00:00Z",
          apiReleaseSha: "friends-api-sha",
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
      values: {
        sourceWeights: {
          following: 0.3,
          networkLikes: 0.2,
          authorsTopics: 0.25,
          popular: 0.25,
        },
        freshness: 5,
        politics: 1,
        purpose: 0.5,
      },
      valuesFor(feedName: "your-feed" | "best-of-friends" | "random") {
        if (feedName === "best-of-friends") {
          return { ...this.values, freshness: 2, purpose: 0.65 };
        }
        if (feedName === "random") {
          return { ...this.values, freshness: 1, purpose: 0.5 };
        }
        return this.values;
      },
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
    window.location.hash = "/settings";
    const { root, submit } = makeRoot("friends-request");

    await new FeedbackStore(root).submit("controls", "Let me tune this feed.", "best-of-friends");

    const sent = submit.mock.calls[0]?.[0] as unknown as FeedbackSubmission;
    expect(sent).toMatchObject({
      distinctId: "did:plc:alice",
      surface: "controls",
      appRoute: "/settings",
      feedName: "best-of-friends",
      feedLabel: "Best of Friends",
      apiReleaseSha: "friends-api-sha",
      snapshot: {
        requestId: "friends-request",
        feedName: "best-of-friends",
      },
    });
    expect(sent.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not attach the current snapshot when another feed is selected", async () => {
    const { root, submit } = makeRoot("greenearth-request");

    await new FeedbackStore(root).submit("general", "Random feedback.", "random");

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        feedName: "random",
        feedLabel: "Random",
        apiReleaseSha: null,
        snapshot: null,
      }),
    );
  });

  it("uses the selected feed summary API SHA without attaching another feed's snapshot", async () => {
    const { root, submit } = makeRoot("greenearth-request");

    await new FeedbackStore(root).submit(
      "howItWorks",
      "How does this feed work?",
      "best-of-friends",
    );

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        feedName: "best-of-friends",
        apiReleaseSha: "friends-api-sha",
        snapshot: null,
      }),
    );
  });
});

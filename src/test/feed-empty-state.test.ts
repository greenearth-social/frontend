import { describe, expect, it } from "vitest";
import { emptySnapshotExplanation } from "../models/feed-empty-state";

describe("WAIST empty snapshot explanations", () => {
  it("explains a real source-empty refresh", () => {
    const explanation = emptySnapshotExplanation(
      {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
      [
        {
          name: "followed_users",
          weight: 1,
          requestedCount: 30,
          returnedCount: 0,
          contributedCount: 0,
          status: "empty",
          reason: "no_recent_followed_posts",
          mode: "primary",
        },
      ],
    );

    expect(explanation).toContain("no recent followed posts");
    expect(explanation).not.toContain("You have not refreshed");
  });

  it("explains an empty Authors & Topics corpus window", () => {
    const explanation = emptySnapshotExplanation(
      null,
      [
        {
          name: "two_tower",
          weight: 1,
          requestedCount: 30,
          returnedCount: 0,
          contributedCount: 0,
          status: "empty",
          reason: "no_recent_authors_topics_posts",
          mode: "primary",
        },
      ],
    );

    expect(explanation).toContain("Authors & Topics found no recent matching posts");
  });

  it("explains when ranked posts all became filtered or unavailable", () => {
    const explanation = emptySnapshotExplanation(
      {
        storedItemCount: 3,
        displayedItemCount: 0,
        publiclyFilteredCount: 1,
        unavailableCount: 2,
      },
      [],
    );

    expect(explanation).toContain("ranked 3 posts");
    expect(explanation).toContain("1 was filtered");
    expect(explanation).toContain("2 were unavailable");
  });

  it("preserves the hydration failure boundary for an accepted empty Preview", () => {
    const explanation = emptySnapshotExplanation(
      {
        storedItemCount: 0,
        displayedItemCount: 0,
        publiclyFilteredCount: 0,
        unavailableCount: 0,
      },
      [
        {
          name: "followed_users",
          weight: 1,
          requestedCount: 30,
          returnedCount: 4,
          contributedCount: 4,
          status: "empty",
          reason: "hydration_removed_all",
          mode: "primary",
        },
      ],
    );

    expect(explanation).toContain("ranked posts");
    expect(explanation).toContain("could not load any of them");
  });
});

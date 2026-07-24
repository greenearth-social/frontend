import { describe, expect, it } from "vitest";
import { RankScoresChart } from "../components/rank-scores-chart";
import type { FeedItemView } from "../models/feed-debug-snapshot";

function item(): FeedItemView {
  return {
    atUri: "at://post/1",
    postUrl: null,
    finalPosition: 1,
    author: "@alice.test",
    displayName: "Alice",
    avatarUrl: null,
    createdAt: "",
    content: "",
    mediaLabels: [],
    imageUrls: [],
    videoUrl: null,
    linkCard: null,
    generators: [{ name: "followed_users", score: 1 }],
    rankPosition: 1,
    rankScore: 0.6,
    afterRankPosition: 1,
    modelScores: [
      { name: "heavy_ranker", weight: 1, score: 0.7 },
      { name: "perspective", weight: 1, score: 0.5 },
    ],
    diversification: {
      relevance: 1,
      score: 0.3,
      authorPenalty: 0.1,
      contentPenalty: 0.05,
    },
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
  };
}

describe("RankScoresChart", () => {
  it("keeps sources vertical on desktop and lays them out horizontally on mobile", () => {
    const styles = RankScoresChart.styles.cssText;

    expect(styles).toMatch(/\.source-content\s*\{[^}]*flex-direction:\s*column/s);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*600px\)[\s\S]*\.source-content\s*\{[^}]*flex-direction:\s*row/s,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*600px\)[\s\S]*\.source-content\s*\{[^}]*align-content:\s*center/s,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*600px\)[\s\S]*\.source-content\s*\{[^}]*justify-content:\s*center/s,
    );
  });

  it("uses the post-diversification selection score as the final score", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".score-value")?.textContent.trim()).toBe("0.30");
    expect(element.shadowRoot?.querySelector(".div-value")?.textContent.trim()).toBe("-0.15");
    element.remove();
  });
});

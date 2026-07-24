import { describe, expect, it } from "vitest";
import { RankScoresChart } from "../components/rank-scores-chart";
import type { FeedItemView } from "../models/feed-debug-snapshot";

function normalizedText(element: Element | null | undefined): string {
  return element?.textContent.replace(/\s+/g, " ").trim() ?? "";
}

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
      score: 0.15,
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

    expect(element.shadowRoot?.querySelector(".score-value")?.textContent.trim()).toBe("0.15");
    expect(element.shadowRoot?.querySelector(".div-value")?.textContent.trim()).toBe("-0.15");
    element.remove();
  });

  it("explains a diversified score with the post's actual formula values", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".score-info-button")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".score-popup");
    const text = normalizedText(popup);
    expect(text).toContain("(0.30 × 1.000) − 0.150 = 0.150");
    expect(text).toContain("(0.700 × 1.00) + (0.500 × 1.00) = 1.200");
    expect(text).toContain("1.200 ÷ 2.00 = 0.600");
    expect(text).toContain("0.600 ÷ 0.600 = 1.000 relevance");
    expect(text).toContain("0.30 multiplier is a fixed feed setting");
    expect(text).toContain("Lower values favor variety");
    expect(text).not.toContain("Engaging score 0.700");
    expect(text).not.toContain("Constructive score 0.500");
    expect(text).not.toContain("Author repetition");
    expect(text).not.toContain("Similar posts");
    element.remove();
  });

  it("shows the penalty values used in the diversification adjustment", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLElement>(".info-icon")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".div-popup");
    const text = normalizedText(popup);
    expect(text).toContain("− (0.100 + 0.050) = -0.150");
    expect(text).toContain("Repeated-author penalty 0.100");
    expect(text).toContain("Similar-content penalty 0.050");
    expect(text).toContain("Diversification adjustment -0.150");
    element.remove();
  });

  it("derives the displayed ordering score from the recorded formula inputs", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = {
      ...item(),
      rankScore: 0.91,
      modelScores: [
        { name: "heavy_ranker", weight: 0.5, score: 0.95 },
        { name: "perspective", weight: 0.5, score: 0.83 },
      ],
      diversification: {
        relevance: 0.91,
        score: 0.91,
        authorPenalty: 0,
        contentPenalty: 0,
      },
    };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".score-value")?.textContent.trim()).toBe("0.27");

    element.shadowRoot?.querySelector<HTMLButtonElement>(".score-info-button")?.click();
    await element.updateComplete;

    const text = normalizedText(element.shadowRoot?.querySelector(".score-popup"));
    expect(text).toContain("(0.950 × 0.50) + (0.830 × 0.50) = 0.890");
    expect(text).toContain("0.890 ÷ 1.00 = 0.890");
    expect(text).toContain("0.890 ÷ 0.978 = 0.910 relevance");
    expect(text).toContain("(0.30 × 0.910) − 0.000 = 0.273");
    element.remove();
  });

  it("explains the weighted ranker formula when diversification is absent", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = { ...item(), diversification: null };
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".score-info-button")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".score-popup");
    const text = normalizedText(popup);
    expect(text).toContain("1.200 ÷ 2.00 = 0.600");
    expect(text).not.toContain("Engaging: 0.700");
    expect(text).not.toContain("Constructive: 0.500");
    element.remove();
  });
});

import { describe, expect, it } from "vitest";
import { RankScoresChart } from "../components/rank-scores-chart";
import type { FeedItemView } from "../models/feed-debug-snapshot";

function normalizedText(element: Node | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
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
      { name: "heavy_ranker", weight: 0.5, score: 0.7 },
      { name: "perspective", weight: 0.5, score: 0.5 },
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
  it.each(["heavy_ranker", "heavy_ranker_empty_history"])(
    "shows %s as the Engaging ranker",
    async (rankerName) => {
      const element = document.createElement("rank-scores-chart");
      element.item = {
        ...item(),
        modelScores: [
          { name: rankerName, weight: 1, score: 0.7 },
          { name: "perspective", weight: 1, score: 0.5 },
        ],
      };
      document.body.appendChild(element);
      await element.updateComplete;

      const rows = [...(element.shadowRoot?.querySelectorAll(".ranker-item") ?? [])];
      const engagingRow = rows.find((row) =>
        row.querySelector(".ranker-label")?.textContent.includes("Engaging"),
      );
      expect(engagingRow?.querySelector(".ranker-value")?.textContent.trim()).toBe("0.70");
      expect(engagingRow?.querySelector<HTMLElement>(".ranker-bar-fill")?.style.width).toBe("70%");
      element.remove();
    },
  );

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

  it("leaves a tappable backdrop above and below popups on small screens", () => {
    const styles = RankScoresChart.styles.cssText;

    expect(styles).toMatch(
      /@media\s*\(max-width:\s*600px\)[\s\S]*\.(?:div-popup|score-popup)[\s\S]*max-height:\s*calc\(100dvh\s*-\s*3rem\)/s,
    );
  });

  it("uses the recorded Maximum Marginal Relevance selection score", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".score-value")?.textContent.trim()).toBe("0.15");
    expect(element.shadowRoot?.querySelector(".div-value")?.textContent.trim()).toBe("-0.15");
    element.remove();
  });

  it("explains the selection formula and Maximum Marginal Relevance ordering", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".final-score-info-button")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".score-popup");
    const text = normalizedText(popup);
    expect(text).toContain("Ranker scores are multiplied by their influence and summed");
    expect(text).toContain("(0.700 × 0.50) + (0.500 × 0.50) = 0.600");
    expect(text).not.toContain("total influence");
    expect(text).toContain("0.600 ÷ 0.600 = 1.000 relevance");
    expect(text).toContain("Maximum Marginal Relevance (MMR)");
    expect(text).toContain("(0.30 × 1.000) − 0.150 = 0.150");
    expect(text).toContain("score that caused this post to be selected at this position");
    expect(text).toContain("selection scores across positions do not have to decrease");
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

    element.shadowRoot?.querySelector<HTMLButtonElement>(".diversification-info-button")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".div-popup");
    const text = normalizedText(popup);
    expect(text).toContain("− (0.100 + 0.050) = -0.150");
    expect(text).toContain("Repeated-author penalty 0.100");
    expect(text).toContain("Similar-content penalty 0.050");
    expect(text).toContain("Diversification adjustment -0.150");
    element.remove();
  });

  it("derives the selection score from relevance and penalties", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = {
      ...item(),
      rankScore: 0.89,
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

    element.shadowRoot?.querySelector<HTMLButtonElement>(".final-score-info-button")?.click();
    await element.updateComplete;

    const text = normalizedText(element.shadowRoot?.querySelector(".score-popup"));
    expect(text).toContain("(0.950 × 0.50) + (0.830 × 0.50) = 0.890");
    expect(text).not.toContain("0.890 ÷ 1.00");
    expect(text).toContain("(0.30 × 0.910) − 0.000 = 0.273");
    element.remove();
  });

  it("falls back to the weighted model score without diversification or rankScore", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = { ...item(), rankScore: null, diversification: null };
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".score-value")?.textContent.trim()).toBe("0.60");
    element.remove();
  });

  it("explains the weighted ranker formula when diversification is absent", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = { ...item(), diversification: null };
    document.body.appendChild(element);
    await element.updateComplete;

    element.shadowRoot?.querySelector<HTMLButtonElement>(".final-score-info-button")?.click();
    await element.updateComplete;

    const popup = element.shadowRoot?.querySelector(".score-popup");
    const text = normalizedText(popup);
    expect(text).toContain("(0.700 × 0.50) + (0.500 × 0.50) = 0.600");
    expect(text).not.toContain("÷ 1.00");
    expect(text).not.toContain("Engaging: 0.700");
    expect(text).not.toContain("Constructive: 0.500");
    element.remove();
  });

  it("makes every explanation header clickable", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    const cases = [
      [".source-info-button", ".info-popup", "candidate generators found this post"],
      [".rankers-info-button", ".info-popup", "how engaging and constructive"],
      [".diversification-info-button", ".div-popup", "Diversification Formula"],
      [".final-score-info-button", ".score-popup", "selection score was calculated"],
    ] as const;

    expect(element.shadowRoot?.querySelectorAll(".header-question")).toHaveLength(4);
    for (const [buttonSelector, popupSelector, popupText] of cases) {
      const button = element.shadowRoot?.querySelector<HTMLButtonElement>(buttonSelector);
      expect(button?.tagName).toBe("BUTTON");
      button?.click();
      await element.updateComplete;
      expect(normalizedText(element.shadowRoot?.querySelector(popupSelector))).toContain(popupText);
      button?.click();
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(popupSelector)).toBeNull();
    }
    element.remove();
  });

  it("opens the matching explanation from source pills, bars, and score values", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    document.body.appendChild(element);
    await element.updateComplete;

    const cases = [
      [".source-pill-button", ".info-popup"],
      [".ranker-value-button", ".info-popup"],
      [".diversification-value-button", ".div-popup"],
      [".final-score-value-button", ".score-popup"],
    ] as const;

    for (const [buttonSelector, popupSelector] of cases) {
      const button = element.shadowRoot?.querySelector<HTMLButtonElement>(buttonSelector);
      expect(button?.tagName).toBe("BUTTON");
      button?.click();
      await element.updateComplete;
      expect(element.shadowRoot?.querySelector(popupSelector)).not.toBeNull();
      button?.click();
      await element.updateComplete;
    }
    element.remove();
  });

  it("shows only the random source pill for the Random feed", async () => {
    const element = document.createElement("rank-scores-chart");
    element.item = item();
    element.algorithmId = "random";
    document.body.appendChild(element);
    await element.updateComplete;

    expect(normalizedText(element.shadowRoot)).toBe("Source:");
    const badge = element.shadowRoot?.querySelector("generator-badge");
    await badge?.updateComplete;
    expect(normalizedText(badge?.shadowRoot)).toBe("random");
    expect(element.shadowRoot?.querySelectorAll("generator-badge")).toHaveLength(1);
    expect(element.shadowRoot?.querySelector(".ranking-grid")).toBeNull();
    expect(element.shadowRoot?.querySelector(".final-score-info-button")).toBeNull();

    element.shadowRoot?.querySelector<HTMLButtonElement>(".random-source-pill-button")?.click();
    await element.updateComplete;
    expect(normalizedText(element.shadowRoot?.querySelector(".info-popup"))).toContain(
      "without ranking or diversification",
    );
    element.remove();
  });
});

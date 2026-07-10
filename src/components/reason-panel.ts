import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { weightedRankScore } from "../models/feed-debug-snapshot";
import "./generator-badge";
import "./score-axis";
import type { ScoreDot } from "./score-axis";

@customElement("reason-panel")
export class ReasonPanel extends MobxLitElement {
  @property({ type: Object }) item: FeedItemView | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const finalScore =
      i.rankScore !== null
        ? i.rankScore
        : weightedRankScore(i.modelScores);

    const scoreDots: ScoreDot[] = i.modelScores.map((ms) => ({
      label: ms.name,
      score: ms.score,
      color: ms.name === "two_tower" ? "#22c55e" : "#8b5cf6",
    }));

    if (finalScore !== null) {
      scoreDots.push({
        label: "final",
        score: finalScore,
        color: "#111827",
      });
    }

    return html`
      <div class="bg-gray-50 rounded-lg p-3 space-y-3 text-sm border border-gray-200">
        <!-- Generator badges -->
        <div>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Generators</span>
          <div class="flex flex-wrap gap-1 mt-1">
            ${i.generators.length > 0
              ? i.generators.map(
                  (g) =>
                    html`<generator-badge name=${g.name} .score=${g.score}></generator-badge>`,
                )
              : html`<span class="text-gray-400 text-xs">none</span>`}
          </div>
        </div>

        <!-- Model scores -->
        ${i.modelScores.length > 0
          ? html`
              <div>
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Model Scores
                </span>
                <score-axis .dots=${scoreDots}></score-axis>
              </div>
            `
          : ""}

        <!-- Rank position -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          ${i.rankPosition !== null
            ? html`
                <div>
                  <span class="text-gray-500">Rank position</span>
                  <span class="font-semibold ml-1">#${i.rankPosition}</span>
                </div>
              `
            : ""}
          ${i.afterRankPosition !== null
            ? html`
                <div>
                  <span class="text-gray-500">After rank pos</span>
                  <span class="font-semibold ml-1">#${i.afterRankPosition}</span>
                </div>
              `
            : ""}
          ${finalScore !== null
            ? html`
                <div>
                  <span class="text-gray-500">Final score</span>
                  <span class="font-semibold ml-1"
                    >${(finalScore * 100).toFixed(1)}%</span
                  >
                </div>
              `
            : ""}
          <div>
            <span class="text-gray-500">Final position</span>
            <span class="font-semibold ml-1">#${i.finalPosition}</span>
          </div>
        </div>

        <!-- Diversification -->
        ${i.diversification
          ? html`
              <div>
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diversification</span>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
                  <div>
                    <span class="text-gray-500">Relevance</span>
                    <span class="font-medium ml-1"
                      >${(i.diversification.score * 100).toFixed(0)}%</span
                    >
                  </div>
                  <div>
                    <span class="text-gray-500">Author penalty</span>
                    <span class="font-medium ml-1"
                      >${(i.diversification.authorPenalty * 100).toFixed(0)}%</span
                    >
                  </div>
                  <div>
                    <span class="text-gray-500">Content penalty</span>
                    <span class="font-medium ml-1"
                      >${(i.diversification.contentPenalty * 100).toFixed(0)}%</span
                    >
                  </div>
                  <div>
                    <span class="text-gray-500">Effective relevance</span>
                    <span class="font-medium ml-1"
                      >${(
                        (i.diversification.score +
                          i.diversification.authorPenalty +
                          i.diversification.contentPenalty) *
                        100
                      ).toFixed(0)}%</span
                    >
                  </div>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "reason-panel": ReasonPanel;
  }
}

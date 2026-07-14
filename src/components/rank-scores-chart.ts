import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { weightedRankScore, scoreAxisPositionPct } from "../models/feed-debug-snapshot";

@customElement("rank-scores-chart")
export class RankScoresChart extends LitElement {
  @property({ type: Object }) item: FeedItemView | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .chart-container {
      padding: 0.25rem 0;
    }
    .chart-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .chart-title {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--bluesky-text-secondary);
    }
    .chart-score {
      font-size: 1.375rem;
      font-weight: 800;
      color: var(--bluesky-text);
    }
    .axis-area {
      position: relative;
      height: 28px;
      margin-bottom: 1.25rem;
    }
    .axis-line {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--bluesky-border);
      transform: translateY(-50%);
    }
    .axis-tick {
      position: absolute;
      top: 50%;
      width: 1px;
      height: 8px;
      background: var(--bluesky-text-secondary);
      transform: translateY(-50%);
    }
    .axis-label {
      position: absolute;
      top: 100%;
      font-size: 0.625rem;
      color: var(--bluesky-text-secondary);
      transform: translateX(-50%);
      margin-top: 2px;
    }
    .dot {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--bluesky-bg-card);
      box-shadow: 0 0 0 1px var(--bluesky-border);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      font-size: 0.75rem;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-label {
      color: var(--bluesky-text-secondary);
    }
    .legend-value {
      font-weight: 600;
      color: var(--bluesky-text);
    }
  `;

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const finalScore =
      i.rankScore !== null
        ? i.rankScore
        : weightedRankScore(i.modelScores);

    const MODEL_COLORS: Record<string, string> = {
      heavy_ranker: "#fb923c",
      perspective: "#a78bfa",
      candidate_score: "#34d399",
    };
    const DEFAULT_MODEL_COLOR = "#38bdf8";

    const dots = i.modelScores.map((ms) => ({
      label: ms.name,
      score: ms.score,
      color: MODEL_COLORS[ms.name] ?? DEFAULT_MODEL_COLOR,
    }));

    if (finalScore !== null) {
      dots.push({
        label: "final rank",
        score: finalScore,
        color: "#fbbf24",
      });
    }

    const ticks = [
      { pos: 0, label: "-1" },
      { pos: 50, label: "0" },
      { pos: 100, label: "1" },
    ];

    return html`
      <div class="chart-container">
        <div class="chart-header">
          <span class="chart-title">Rank Scores</span>
          ${finalScore !== null
            ? html`<span class="chart-score">${finalScore.toFixed(2)}</span>`
            : ""}
        </div>

        <div class="axis-area">
          <div class="axis-line"></div>
          ${ticks.map(
            (t) => html`
              <div class="axis-tick" style="left: ${t.pos}%"></div>
              <span class="axis-label" style="left: ${t.pos}%">${t.label}</span>
            `,
          )}
          ${dots.map(
            (dot) => html`
              <div
                class="dot"
                style="left: ${scoreAxisPositionPct(dot.score)}%; background-color: ${dot.color};"
                title="${dot.label}: ${dot.score.toFixed(3)}"
              ></div>
            `,
          )}
        </div>

        <div class="legend">
          ${dots.map(
            (dot) => html`
              <div class="legend-item">
                <div class="legend-dot" style="background-color: ${dot.color};"></div>
                <span class="legend-label">${dot.label}</span>
                <span class="legend-value">${dot.score.toFixed(2)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rank-scores-chart": RankScoresChart;
  }
}

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { weightedRankScore } from "../models/feed-debug-snapshot";
import { styleMap } from "lit/directives/style-map.js";
import "./generator-badge";

const RANKER_COLORS: Record<string, string> = {
  Engaging: "#fb923c",
  Constructive: "#a78bfa",
};

@customElement("rank-scores-chart")
export class RankScoresChart extends LitElement {
  @property({ type: Object }) item: FeedItemView | null = null;
  @state() private _showDivPopup = false;

  static styles = css`
    :host {
      display: block;
    }
    .chart-container {
      padding: 0.25rem 0;
    }
    .ranking-grid {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 1rem;
      align-items: start;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .col-header {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--bluesky-text-secondary);
      padding-bottom: 0.375rem;
      border-bottom: 1px solid var(--bluesky-border);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .info-icon {
      cursor: pointer;
      font-size: 0.75rem;
      color: var(--bluesky-text-secondary);
      transition: color 0.15s;
    }
    .info-icon:hover {
      color: var(--bluesky-brand);
    }
    .source-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: stretch;
      justify-content: center;
    }
    .rankers-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .ranker-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .ranker-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--bluesky-text);
      white-space: nowrap;
    }
    .ranker-bar-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .ranker-bar-outer {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      border: 1px solid;
      overflow: hidden;
      min-width: 50px;
    }
    .ranker-bar-fill {
      height: 100%;
      border-radius: 3px;
    }
    .ranker-value {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--bluesky-text);
      min-width: 2.75em;
      text-align: right;
    }
    .div-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      position: relative;
    }
    .div-value {
      font-size: 0.875rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .div-positive {
      color: #22c55e;
    }
    .div-negative {
      color: #f4212e;
    }
    .div-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 0.75rem;
      line-height: 1.5;
      color: var(--bluesky-text);
      width: 280px;
      z-index: 101;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .div-popup-title {
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--bluesky-text);
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      z-index: 100;
    }
    .score-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
    }
    .score-value {
      font-size: 1.375rem;
      font-weight: 800;
      color: var(--bluesky-text);
      white-space: nowrap;
    }
    @media (max-width: 600px) {
      .ranking-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .section {
        flex: 1 1 120px;
        min-width: 120px;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 0.5rem;
      }
    }
  `;

  private _toggleDivPopup() {
    this._showDivPopup = !this._showDivPopup;
  }

  private _closeDivPopup() {
    this._showDivPopup = false;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._handleOutsideClick);
  }

  private _handleOutsideClick = (e: Event) => {
    if (this._showDivPopup) {
      const path = e.composedPath();
      if (!path.includes(this)) {
        this._closeDivPopup();
      }
    }
  };

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const finalScore =
      i.rankScore !== null
        ? i.rankScore
        : weightedRankScore(i.modelScores);

    const engaging = i.modelScores.find((m) => m.name === "heavy_ranker");
    const constructive = i.modelScores.find((m) => m.name === "perspective");

    const engagingScore = engaging?.score ?? 0;
    const constructiveScore = constructive?.score ?? 0;

    const engagingPct = Math.max(0, engagingScore) * 100;
    const constructivePct = Math.max(0, constructiveScore) * 100;

    const rawScore = (engagingScore + constructiveScore) / 2;
    let divDelta = 0;
    let divDeltaStr = "\u2014";
    if (i.diversification) {
      divDelta = i.diversification.score - rawScore;
      divDeltaStr =
        divDelta >= 0 ? `+${divDelta.toFixed(2)}` : divDelta.toFixed(2);
    }

    const rankerRows = [
      { label: "Engaging", score: engagingScore, pct: engagingPct },
      { label: "Constructive", score: constructiveScore, pct: constructivePct },
    ];

    return html`
      ${this._showDivPopup
        ? html`<div class="backdrop" @click=${() => { this._closeDivPopup(); }}></div>`
        : ""}
      <div class="chart-container">
        <div class="ranking-grid">
          <div class="section">
            <div class="col-header">Source</div>
            <div class="source-content">
              ${i.generators.map(
                (g) => html`<generator-badge name=${g.name} .score=${g.score}></generator-badge>`,
              )}
            </div>
          </div>

          <div class="section">
            <div class="col-header">Rankers</div>
            <div class="rankers-content">
              ${rankerRows.map((rr) => {
                const color = RANKER_COLORS[rr.label] ?? "#71767b";
                return html`
                  <div class="ranker-item">
                    <span class="ranker-label">${rr.label}</span>
                    <div class="ranker-bar-row">
                      <div
                        class="ranker-bar-outer"
                        style=${styleMap({ borderColor: color })}
                      >
                        <div
                          class="ranker-bar-fill"
                          style=${styleMap({
                            width: `${String(rr.pct)}%`,
                            backgroundColor: color,
                          })}
                        ></div>
                      </div>
                      <span class="ranker-value">${rr.score.toFixed(2)}</span>
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>

          <div class="section">
            <div class="col-header">
              Diversification
              <wa-icon
                name="info-circle"
                library="app"
                class="info-icon"
                @click=${(e: Event) => { e.stopPropagation(); this._toggleDivPopup(); }}
              ></wa-icon>
            </div>
            <div class="div-content">
              <div
                class="div-value ${divDelta >= 0 ? "div-positive" : "div-negative"}"
              >
                ${divDeltaStr}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="col-header">Score</div>
            <div class="score-content">
              <div class="score-value">
                ${finalScore !== null ? finalScore.toFixed(2) : "\u2014"}
              </div>
            </div>
          </div>
        </div>
      </div>
      ${this._showDivPopup
        ? html`
            <div class="div-popup">
              <div class="div-popup-title">Diversification Formula</div>
              <p>
                The diversification score is the difference between the raw score
                (currently 0.5 × Engaging + 0.5 × Constructive) and the calculated
                score after diversification.
              </p>
              <p>
                This can be positive or negative, indicating whether diversification
                increased or decreased the final score.
              </p>
            </div>
          `
        : ""}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rank-scores-chart": RankScoresChart;
  }
}

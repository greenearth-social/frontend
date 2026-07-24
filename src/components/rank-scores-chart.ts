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
  @state() private _showScorePopup = false;

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
      align-items: stretch;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      height: 100%;
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
    .score-info-button {
      display: inline-grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--bluesky-text-secondary);
      cursor: pointer;
    }
    .score-info-button:hover,
    .score-info-button:focus-visible {
      color: var(--bluesky-brand);
      outline: none;
    }
    .score-info-button wa-icon {
      font-size: 0.75rem;
    }
    .source-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: stretch;
      justify-content: center;
      flex: 1;
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
      flex: 1;
    }
    .div-value {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--bluesky-text);
      white-space: nowrap;
    }
    .div-popup,
    .score-popup {
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
      width: min(280px, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      box-sizing: border-box;
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: 101;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .div-popup-title,
    .score-popup-title {
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--bluesky-text);
    }
    .score-formula {
      margin: 0.75rem 0;
      padding: 0.65rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.4rem;
      background: rgba(255, 255, 255, 0.03);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.72rem;
      font-weight: 700;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .formula-values {
      display: grid;
      gap: 0.45rem;
      margin: 0;
    }
    .formula-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: start;
    }
    .formula-label {
      color: var(--bluesky-text-secondary);
    }
    .formula-number {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      text-align: right;
    }
    .score-popup p {
      margin: 0.5rem 0;
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
      flex: 1;
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
        height: auto;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 0.5rem;
      }
      .source-content {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        align-content: center;
        justify-content: center;
      }
      .div-popup,
      .score-popup {
        width: calc(100vw - 1rem);
        max-height: calc(100dvh - 1rem);
        padding: 0.625rem;
      }
      .score-formula {
        margin: 0.5rem 0;
        padding: 0.5rem;
        font-size: 0.68rem;
      }
    }
  `;

  private _toggleDivPopup() {
    this._showDivPopup = !this._showDivPopup;
    this._showScorePopup = false;
  }

  private _toggleScorePopup() {
    this._showScorePopup = !this._showScorePopup;
    this._showDivPopup = false;
  }

  private _closePopups() {
    this._showDivPopup = false;
    this._showScorePopup = false;
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
    if (this._showDivPopup || this._showScorePopup) {
      const path = e.composedPath();
      if (!path.includes(this)) {
        this._closePopups();
      }
    }
  };

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const finalScore = i.diversification
      ? 0.3 * i.diversification.relevance -
        i.diversification.authorPenalty -
        i.diversification.contentPenalty
      : (i.rankScore ?? weightedRankScore(i.modelScores));

    const engaging = i.modelScores.find((m) => m.name === "heavy_ranker");
    const constructive = i.modelScores.find((m) => m.name === "perspective");

    const engagingScore = engaging?.score ?? 0;
    const constructiveScore = constructive?.score ?? 0;

    const engagingPct = Math.max(0, engagingScore) * 100;
    const constructivePct = Math.max(0, constructiveScore) * 100;

    let divDelta = 0;
    let divDeltaStr = "\u2014";
    if (i.diversification) {
      divDelta = -(i.diversification.authorPenalty + i.diversification.contentPenalty);
      divDeltaStr = divDelta >= 0 ? `+${divDelta.toFixed(2)}` : divDelta.toFixed(2);
    }

    const rankerRows = [
      { label: "Engaging", score: engagingScore, pct: engagingPct },
      { label: "Constructive", score: constructiveScore, pct: constructivePct },
    ];

    return html`
      ${
        this._showDivPopup || this._showScorePopup
          ? html`<div
              class="backdrop"
              @click=${() => {
                this._closePopups();
              }}
            ></div>`
          : ""
      }
      <div class="chart-container">
        <div class="ranking-grid">
          <div class="section">
            <div class="col-header">Source</div>
            <div class="source-content">
              ${i.generators.map((g) => html`<generator-badge name=${g.name}></generator-badge>`)}
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
                      <div class="ranker-bar-outer" style=${styleMap({ borderColor: color })}>
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
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._toggleDivPopup();
                }}
              ></wa-icon>
            </div>
            <div class="div-content">
              <div class="div-value">${divDeltaStr}</div>
            </div>
          </div>

          <div class="section">
            <div class="col-header">
              Score
              <button
                class="score-info-button"
                type="button"
                aria-label="Explain this post's score"
                title="Explain score"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this._toggleScorePopup();
                }}
              >
                <wa-icon name="info-circle" library="app"></wa-icon>
              </button>
            </div>
            <div class="score-content">
              <div class="score-value">
                ${finalScore !== null ? finalScore.toFixed(2) : "\u2014"}
              </div>
            </div>
          </div>
        </div>
      </div>
      ${
        this._showDivPopup
          ? html`
              <div class="div-popup">
                <div class="div-popup-title">Diversification Formula</div>
                <p>
                  Diversification lowers a post when its author has appeared recently or its content
                  is similar to posts already selected.
                </p>
                ${
                  i.diversification
                    ? html`
                        <div class="score-formula">
                          − (${i.diversification.authorPenalty.toFixed(3)} +
                          ${i.diversification.contentPenalty.toFixed(3)}) = ${divDelta.toFixed(3)}
                        </div>
                        <div class="formula-values">
                          ${this.#formulaRow(
                            "Repeated-author penalty",
                            i.diversification.authorPenalty,
                          )}
                          ${this.#formulaRow(
                            "Similar-content penalty",
                            i.diversification.contentPenalty,
                          )}
                          ${this.#formulaRow("Diversification adjustment", divDelta)}
                        </div>
                      `
                    : html`<p>No diversification adjustment was recorded.</p>`
                }
              </div>
            `
          : ""
      }
      ${this._showScorePopup ? this.#renderScorePopup(i, finalScore) : ""}
    `;
  }

  #renderScorePopup(i: FeedItemView, finalScore: number | null) {
    const totalWeight = i.modelScores.reduce((sum, model) => sum + model.weight, 0);
    const weightedTotal = i.modelScores.reduce((sum, model) => sum + model.score * model.weight, 0);

    if (i.diversification) {
      const relevanceWeight = 0.3;
      const relevance = i.diversification.relevance;
      const relevanceContribution = relevanceWeight * relevance;
      const authorPenalty = i.diversification.authorPenalty;
      const contentPenalty = i.diversification.contentPenalty;
      const diversificationReduction = authorPenalty + contentPenalty;
      const score = relevanceContribution - diversificationReduction;
      const combinedRankerScore = totalWeight > 0 ? weightedTotal / totalWeight : i.rankScore;
      const batchLeaderScore =
        combinedRankerScore !== null && relevance > 0 ? combinedRankerScore / relevance : null;
      const weightedParts = i.modelScores
        .map((model) => `(${model.score.toFixed(3)} × ${model.weight.toFixed(2)})`)
        .join(" + ");
      return html`
        <div class="score-popup" role="dialog" aria-modal="true" aria-label="Score formula">
          <div class="score-popup-title">How this score was calculated</div>
          <p>
            Ranker scores are multiplied by their influence, added, and divided by the total
            influence.
          </p>
          ${
            i.modelScores.length > 0 && totalWeight > 0
              ? html`
                  <div class="score-formula">
                    ${weightedParts} = ${weightedTotal.toFixed(3)}<br />
                    ${weightedTotal.toFixed(3)} ÷ ${totalWeight.toFixed(2)} =
                    ${combinedRankerScore?.toFixed(3) ?? "—"}
                  </div>
                `
              : ""
          }
          <p>Relevance is this combined score divided by the batch's highest combined score.</p>
          ${
            combinedRankerScore !== null && batchLeaderScore !== null
              ? html`
                  <div class="score-formula">
                    ${combinedRankerScore.toFixed(3)} ÷ ${batchLeaderScore.toFixed(3)} =
                    ${relevance.toFixed(3)} relevance
                  </div>
                `
              : ""
          }
          <p>
            The 0.30 multiplier is a fixed feed setting. Lower values favor variety; higher values
            favor relevance.
          </p>
          <div class="score-formula">
            (${relevanceWeight.toFixed(2)} × ${relevance.toFixed(3)}) −
            ${diversificationReduction.toFixed(3)} = ${score.toFixed(3)}
          </div>
        </div>
      `;
    }

    return html`
      <div class="score-popup" role="dialog" aria-modal="true" aria-label="Score formula">
        <div class="score-popup-title">How this score was calculated</div>
        ${
          i.modelScores.length > 0 && totalWeight > 0
            ? html`
                <p>
                  The Engaging and Constructive rankers score this post. Their weighted average
                  produces the score shown here: each score is multiplied by its configured
                  influence, the results are added, then divided by the total influence.
                </p>
                <div class="score-formula">
                  ${weightedTotal.toFixed(3)} ÷ ${totalWeight.toFixed(2)} =
                  ${finalScore?.toFixed(3) ?? "—"}
                </div>
                <div class="formula-values">${this.#formulaRow("Final score", finalScore)}</div>
              `
            : html` <p>No ranking formula was recorded for this legacy snapshot.</p> `
        }
      </div>
    `;
  }

  #formulaRow(label: string, value: number | null) {
    return html`
      <div class="formula-row">
        <span class="formula-label">${label}</span>
        <span class="formula-number">${value === null ? "—" : value.toFixed(3)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rank-scores-chart": RankScoresChart;
  }
}

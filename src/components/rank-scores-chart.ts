import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import type { AlgorithmId } from "../constants/algorithms";
import { styleMap } from "lit/directives/style-map.js";
import "./generator-badge";

const RANKER_COLORS: Record<string, string> = {
  Engaging: "#fb923c",
  Constructive: "#a78bfa",
};

const ENGAGING_RANKER_NAMES = new Set(["heavy_ranker", "heavy_ranker_empty_history"]);

const MMR_RELEVANCE_WEIGHT = 0.3;

@customElement("rank-scores-chart")
export class RankScoresChart extends LitElement {
  @property({ type: Object }) item: FeedItemView | null = null;
  @property({ attribute: false }) algorithmId: AlgorithmId | null = null;
  @property({ type: Number }) engagingInfluence = 0.5;
  @property({ type: Number }) constructiveInfluence = 0.5;
  @state() private _showSourcePopup = false;
  @state() private _showRankersPopup = false;
  @state() private _showDivPopup = false;
  @state() private _showScorePopup = false;

  static styles = css`
    :host {
      display: block;
    }
    .chart-container {
      padding: 0.25rem 0;
    }
    .random-source {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 1.75rem;
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .random-source-label,
    .explanation-value-button,
    .col-header-button {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 0;
      cursor: pointer;
    }
    .random-source-label:hover,
    .random-source-label:focus-visible,
    .col-header-button:hover,
    .col-header-button:focus-visible {
      color: var(--bluesky-brand);
      outline: none;
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
    .col-header-button {
      width: 100%;
      text-align: left;
    }
    .header-question {
      display: inline-grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 9999px;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 800;
    }
    .source-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: stretch;
      justify-content: center;
      flex: 1;
    }
    .source-pill-button {
      width: fit-content;
      border-radius: 9999px;
      -webkit-tap-highlight-color: transparent;
    }
    .explanation-value-button:hover {
      filter: brightness(1.2);
    }
    .explanation-value-button:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--bluesky-brand) 55%, transparent);
      outline-offset: 3px;
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
      width: 100%;
      text-align: left;
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
      display: block;
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
      width: 100%;
    }
    .div-value {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--bluesky-text);
      white-space: nowrap;
    }
    .info-popup,
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
    .info-popup-title,
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
      width: 100%;
    }
    .score-value {
      font-size: 1.375rem;
      font-weight: 800;
      color: var(--bluesky-text);
      white-space: nowrap;
    }
    @media (min-width: 601px) {
      .col-header {
        min-height: 1.25rem;
      }
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
      .info-popup,
      .div-popup,
      .score-popup {
        width: calc(100vw - 1rem);
        max-height: calc(100dvh - 3rem);
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
    this._showSourcePopup = false;
    this._showRankersPopup = false;
    this._showScorePopup = false;
  }

  private _toggleScorePopup() {
    this._showScorePopup = !this._showScorePopup;
    this._showSourcePopup = false;
    this._showRankersPopup = false;
    this._showDivPopup = false;
  }

  private _toggleSourcePopup() {
    this._showSourcePopup = !this._showSourcePopup;
    this._showRankersPopup = false;
    this._showDivPopup = false;
    this._showScorePopup = false;
  }

  private _toggleRankersPopup() {
    this._showRankersPopup = !this._showRankersPopup;
    this._showSourcePopup = false;
    this._showDivPopup = false;
    this._showScorePopup = false;
  }

  private _closePopups() {
    this._showSourcePopup = false;
    this._showRankersPopup = false;
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
    if (
      this._showSourcePopup ||
      this._showRankersPopup ||
      this._showDivPopup ||
      this._showScorePopup
    ) {
      const path = e.composedPath();
      if (!path.includes(this)) {
        this._closePopups();
      }
    }
  };

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const engaging = i.modelScores.find((m) => ENGAGING_RANKER_NAMES.has(m.name));
    const constructive = i.modelScores.find((m) => m.name === "perspective");

    const engagingScore = engaging?.score ?? 0;
    const constructiveScore = constructive?.score ?? 0;
    const configuredRankerScore = i.modelScores.reduce(
      (sum, model) => sum + model.score * this.#rankerInfluence(model.name, model.weight),
      0,
    );
    const relevanceScore = i.modelScores.length > 0 ? configuredRankerScore : i.rankScore;
    const selectionScore = i.diversification
      ? MMR_RELEVANCE_WEIGHT * i.diversification.relevance -
        i.diversification.authorPenalty -
        i.diversification.contentPenalty
      : relevanceScore;

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

    if (this.algorithmId === "random") {
      return html`
        ${
          this._showSourcePopup
            ? html`<div
                  class="backdrop"
                  @click=${() => {
                    this._closePopups();
                  }}
                ></div>
                <div class="info-popup" role="dialog" aria-modal="true" aria-label="Post sources">
                  <div class="info-popup-title">Source</div>
                  <p>
                    The Random feed repeats the latest feed load without ranking or diversification.
                  </p>
                </div>`
            : ""
        }
        <div class="chart-container">
          <div class="random-source">
            <button
              class="random-source-label"
              type="button"
              @click=${() => {
                this._toggleSourcePopup();
              }}
            >
              Source:
            </button>
            <button
              class="explanation-value-button source-pill-button random-source-pill-button"
              type="button"
              aria-label="Explain random source"
              @click=${() => {
                this._toggleSourcePopup();
              }}
            >
              <generator-badge name="random_posts"></generator-badge>
            </button>
          </div>
        </div>
      `;
    }

    return html`
      ${
        this._showSourcePopup ||
        this._showRankersPopup ||
        this._showDivPopup ||
        this._showScorePopup
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
            <button
              class="col-header col-header-button source-info-button"
              type="button"
              aria-label="Explain post sources"
              title="Explain sources"
              @click=${() => {
                this._toggleSourcePopup();
              }}
            >
              Source
              <span class="header-question" aria-hidden="true">?</span>
            </button>
            <div class="source-content">
              ${i.generators.map(
                (g) => html`
                  <button
                    class="explanation-value-button source-pill-button"
                    type="button"
                    aria-label="Explain ${g.name} source"
                    @click=${() => {
                      this._toggleSourcePopup();
                    }}
                  >
                    <generator-badge name=${g.name}></generator-badge>
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="section">
            <button
              class="col-header col-header-button rankers-info-button"
              type="button"
              aria-label="Explain post rankers"
              title="Explain rankers"
              @click=${() => {
                this._toggleRankersPopup();
              }}
            >
              Rankers
              <span class="header-question" aria-hidden="true">?</span>
            </button>
            <div class="rankers-content">
              ${rankerRows.map((rr) => {
                const color = RANKER_COLORS[rr.label] ?? "#71767b";
                return html`
                  <button
                    class="ranker-item explanation-value-button ranker-value-button"
                    type="button"
                    aria-label="Explain ${rr.label} ranker score"
                    @click=${() => {
                      this._toggleRankersPopup();
                    }}
                  >
                    <span class="ranker-label">${rr.label}</span>
                    <span class="ranker-bar-row">
                      <span class="ranker-bar-outer" style=${styleMap({ borderColor: color })}>
                        <span
                          class="ranker-bar-fill"
                          style=${styleMap({
                            width: `${String(rr.pct)}%`,
                            backgroundColor: color,
                          })}
                        ></span>
                      </span>
                      <span class="ranker-value">${rr.score.toFixed(2)}</span>
                    </span>
                  </button>
                `;
              })}
            </div>
          </div>

          <div class="section">
            <button
              class="col-header col-header-button diversification-info-button"
              type="button"
              aria-label="Explain diversification"
              title="Explain diversification"
              @click=${() => {
                this._toggleDivPopup();
              }}
            >
              Diversification
              <span class="header-question" aria-hidden="true">?</span>
            </button>
            <button
              class="div-content explanation-value-button diversification-value-button"
              type="button"
              aria-label="Explain diversification value"
              @click=${() => {
                this._toggleDivPopup();
              }}
            >
              <span class="div-value">${divDeltaStr}</span>
            </button>
          </div>

          <div class="section">
            <button
              class="col-header col-header-button final-score-info-button"
              type="button"
              aria-label="Explain this post's score"
              title="Explain score"
              @click=${() => {
                this._toggleScorePopup();
              }}
            >
              Score
              <span class="header-question" aria-hidden="true">?</span>
            </button>
            <button
              class="score-content explanation-value-button final-score-value-button"
              type="button"
              aria-label="Explain final score value"
              @click=${() => {
                this._toggleScorePopup();
              }}
            >
              <span class="score-value">
                ${selectionScore !== null ? selectionScore.toFixed(2) : "\u2014"}
              </span>
            </button>
          </div>
        </div>
      </div>
      ${
        this._showSourcePopup
          ? html`
              <div class="info-popup" role="dialog" aria-modal="true" aria-label="Post sources">
                <div class="info-popup-title">Source</div>
                <p>
                  Sources show which candidate generators found this post before ranking. A post can
                  be found by more than one source.
                </p>
              </div>
            `
          : ""
      }
      ${
        this._showRankersPopup
          ? html`
              <div class="info-popup" role="dialog" aria-modal="true" aria-label="Post rankers">
                <div class="info-popup-title">Rankers</div>
                <p>
                  Rankers estimate how engaging and constructive a post may be. Each score is
                  multiplied by the ranker's influence when the relevance score is calculated.
                </p>
              </div>
            `
          : ""
      }
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
      ${this._showScorePopup ? this.#renderScorePopup(i, selectionScore) : ""}
    `;
  }

  #renderScorePopup(i: FeedItemView, selectionScore: number | null) {
    const weightedTotal = i.modelScores.reduce(
      (sum, model) => sum + model.score * this.#rankerInfluence(model.name, model.weight),
      0,
    );
    const weightedParts = i.modelScores
      .map(
        (model) =>
          `(${model.score.toFixed(3)} × ${this.#rankerInfluence(model.name, model.weight).toFixed(2)})`,
      )
      .join(" + ");

    if (i.diversification) {
      const relevance = i.diversification.relevance;
      const diversificationReduction =
        i.diversification.authorPenalty + i.diversification.contentPenalty;
      const combinedRankerScore = i.modelScores.length > 0 ? weightedTotal : i.rankScore;
      const batchLeaderScore =
        combinedRankerScore !== null && relevance > 0 ? combinedRankerScore / relevance : null;

      return html`
        <div class="score-popup" role="dialog" aria-modal="true" aria-label="Score formula">
          <div class="score-popup-title">How this selection score was calculated</div>
          <p>Ranker scores are multiplied by their influence and summed.</p>
          ${
            i.modelScores.length > 0
              ? html`
                  <div class="score-formula">${weightedParts} = ${weightedTotal.toFixed(3)}</div>
                `
              : ""
          }
          <p>The combined score is normalized against the strongest post in this batch.</p>
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
            Maximum Marginal Relevance (MMR) then balances relevance against the author and
            similar-content penalties in effect at this position.
          </p>
          <div class="score-formula">
            (${MMR_RELEVANCE_WEIGHT.toFixed(2)} × ${relevance.toFixed(3)}) −
            ${diversificationReduction.toFixed(3)} = ${selectionScore?.toFixed(3) ?? "—"}
          </div>
          <p>
            This is the score that caused this post to be selected at this position. Because the
            penalties change after every pick, selection scores across positions do not have to
            decrease.
          </p>
        </div>
      `;
    }

    const relevanceScore = i.modelScores.length > 0 ? weightedTotal : selectionScore;
    return html`
      <div class="score-popup" role="dialog" aria-modal="true" aria-label="Score formula">
        <div class="score-popup-title">How this relevance score was calculated</div>
        ${
          i.modelScores.length > 0
            ? html`
                <p>
                  Ranker scores are multiplied by their influence and summed. This produces the
                  post's relevance score before diversification.
                </p>
                <div class="score-formula">${weightedParts} = ${weightedTotal.toFixed(3)}</div>
                <div class="formula-values">
                  ${this.#formulaRow("Relevance score", relevanceScore)}
                </div>
              `
            : relevanceScore !== null
              ? html`
                  <p>This is the post's recorded relevance score before diversification.</p>
                  <div class="formula-values">
                    ${this.#formulaRow("Relevance score", relevanceScore)}
                  </div>
                `
              : html`<p>No ranking formula was recorded for this legacy snapshot.</p>`
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

  #rankerInfluence(name: string, fallback: number): number {
    if (ENGAGING_RANKER_NAMES.has(name)) return this.engagingInfluence;
    if (name === "perspective") return this.constructiveInfluence;
    return fallback;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rank-scores-chart": RankScoresChart;
  }
}

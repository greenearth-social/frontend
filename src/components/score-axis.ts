import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { scoreAxisPositionPct } from "../models/feed-debug-snapshot";

export interface ScoreDot {
  label: string;
  score: number;
  color: string;
}

@customElement("score-axis")
export class ScoreAxis extends LitElement {
  @property({ type: Array }) dots: ScoreDot[] = [];

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
  `;

  render() {
    return html`
      <div class="score-axis">
        <div class="relative h-6 mb-4">
          <div class="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2" style="background: var(--bluesky-border);"></div>

          <div class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style="background: var(--bluesky-text-secondary);"></div>
          <span class="absolute top-full left-0 -translate-x-1/2 text-[0.625rem]" style="color: var(--bluesky-text-secondary);">-1</span>

          <div class="absolute top-1/2 left-1/2 -translate-y-1/2 w-1 h-1 rounded-full" style="background: var(--bluesky-text-secondary);"></div>
          <span class="absolute top-full left-1/2 -translate-x-1/2 text-[0.625rem]" style="color: var(--bluesky-text-secondary);">0</span>

          <div class="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style="background: var(--bluesky-text-secondary);"></div>
          <span class="absolute top-full right-0 translate-x-1/2 text-[0.625rem]" style="color: var(--bluesky-text-secondary);">+1</span>

          ${this.dots.map(
            (dot) => html`
              <div
                class="absolute top-1/2 -translate-y-1/2"
                style="left: ${scoreAxisPositionPct(dot.score)}%"
                title="${dot.label}: ${dot.score.toFixed(3)}"
              >
                <div
                  class="w-2.5 h-2.5 rounded-full shadow-sm"
                  style="background-color: ${dot.color}; border: 2px solid var(--bluesky-bg-card);"
                ></div>
                <span
                  class="absolute top-full left-1/2 -translate-x-1/2 text-[0.625rem] font-medium whitespace-nowrap"
                  style="color: ${dot.color}"
                >
                  ${dot.label}
                </span>
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
    "score-axis": ScoreAxis;
  }
}

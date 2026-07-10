import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import { scoreAxisPositionPct, weightedRankScore } from "../models/feed-debug-snapshot";
import "./generator-badge";
import "./media-badges";
import "./reason-panel";

@customElement("feed-item-card")
export class FeedItemCard extends MobxLitElement {
  @property({ type: Object }) item: FeedItemView | null = null;
  @property({ type: Boolean }) expanded = false;

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

    return html`
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
        <div class="p-4">
          <div class="flex items-start gap-3">
            <!-- Final position badge -->
            <span
              class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5"
            >
              ${i.finalPosition}
            </span>

            <div class="flex-1 min-w-0">
              <!-- Author -->
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-sm text-gray-900 truncate">${i.author}</span>
                ${i.generators.length > 0
                  ? i.generators.map(
                      (g) =>
                        html`<generator-badge name=${g.name} .score=${g.score}></generator-badge>`,
                    )
                  : ""}
              </div>

              <!-- Post text -->
              <p class="text-sm text-gray-700 line-clamp-3 mb-2">${i.content}</p>

              <div class="flex items-center gap-2 flex-wrap">
                <media-badges .labels=${i.mediaLabels}></media-badges>

                ${finalScore !== null
                  ? html`
                      <span class="text-xs text-gray-500">
                        Score:
                        <span class="font-medium text-gray-700"
                          >${(finalScore * 100).toFixed(1)}%</span
                        >
                      </span>
                    `
                  : ""}

                ${i.rankPosition !== null
                  ? html`
                      <span class="text-xs text-gray-500">
                        Rank: <span class="font-medium">#${i.rankPosition}</span>
                      </span>
                    `
                  : ""}

                ${i.postUrl
                  ? html`
                      <a
                        href=${i.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-blue-500 hover:text-blue-700 underline ml-auto"
                      >
                        Open in Bluesky ↗
                      </a>
                    `
                  : ""}
              </div>
            </div>

            <!-- expand toggle -->
            <button
              class="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
              @click=${this.#toggle}
              title="Why am I seeing this?"
            >
              ${this.expanded ? "▲" : "▼"}
            </button>
          </div>

          <!-- Score axis mini preview (when collapsed) -->
          ${!this.expanded && finalScore !== null
            ? html`
                <div class="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gray-900 rounded-full transition-all"
                    style="width: ${scoreAxisPositionPct(finalScore)}%"
                  ></div>
                </div>
              `
            : ""}
        </div>

        ${this.expanded
          ? html`
              <div class="border-t border-gray-100 px-4 pb-4">
                <reason-panel .item=${this.item}></reason-panel>
              </div>
            `
          : ""}
      </div>
    `;
  }

  #toggle() {
    this.dispatchEvent(
      new CustomEvent("toggle-expand", {
        bubbles: true,
        composed: true,
        detail: { uri: this.item?.atUri },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-item-card": FeedItemCard;
  }
}

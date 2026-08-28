import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type {
  FeedItemView,
  FilteringCounts,
  GeneratorDiagnostic,
} from "../models/feed-debug-snapshot";
import { emptySnapshotExplanation } from "../models/feed-empty-state";
import type { AlgorithmId } from "../constants/algorithms";
import "./feed-item-card";

@customElement("feed-view")
export class FeedView extends MobxLitElement {
  @property({ type: Array }) items: FeedItemView[] = [];
  @property({ type: String }) blueskyUrl: string = "";
  @property({ type: String }) algorithmLabel: string = "";
  @property({ attribute: false }) algorithmId: AlgorithmId | null = null;
  @property({ type: String }) localUserDid = "";
  @property({ type: Boolean }) hasSnapshot = false;
  @property({ type: String }) generatedAt = "";
  @property({ attribute: false }) filteringCounts: FilteringCounts | null = null;
  @property({ attribute: false }) generatorDiagnostics: GeneratorDiagnostic[] = [];
  @property({ type: Number }) engagingInfluence = 0.5;
  @property({ type: Number }) constructiveInfluence = 0.5;

  static styles = css`
    :host {
      display: block;
    }
    .feed-container {
      padding-bottom: 0.5rem;
      overflow: hidden;
      max-width: 100%;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      min-height: 400px;
      padding: 2rem;
      border-bottom: 1px solid var(--bluesky-border);
    }
    .empty-state-text {
      font-size: 1rem;
      color: var(--bluesky-text-secondary);
      text-align: center;
      line-height: 1.5;
    }
    .empty-state-time {
      margin: -0.5rem 0 0;
      color: var(--bluesky-text-secondary);
      font-size: 0.8125rem;
      text-align: center;
    }
    .local-dev-hint {
      max-width: 34rem;
      margin: -0.25rem 0 0;
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
      line-height: 1.5;
      text-align: center;
    }
    .local-dev-hint code {
      display: inline-block;
      max-width: 100%;
      padding: 0.2rem 0.4rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.375rem;
      color: var(--bluesky-text);
      overflow-wrap: anywhere;
    }
    .open-in-bluesky {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      border: 1px solid var(--bluesky-brand);
      color: var(--bluesky-brand);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .open-in-bluesky:hover {
      background: rgba(32, 139, 254, 0.1);
    }
  `;

  render() {
    if (this.items.length === 0) {
      const label = this.algorithmLabel || "this feed";
      const explanation = this.hasSnapshot
        ? emptySnapshotExplanation(this.filteringCounts, this.generatorDiagnostics)
        : `You have not refreshed ${label} within the last 24 hours.`;
      const generatedTime = this.hasSnapshot ? this.#formattedGeneratedAt() : "";
      return html`
        <div class="empty-state">
          <p class="empty-state-text">${explanation}</p>
          ${generatedTime ? html`<p class="empty-state-time">Refreshed ${generatedTime}</p>` : ""}
          ${
            this.localUserDid && !this.hasSnapshot
              ? html`<p class="local-dev-hint">
                  Local user <code>${this.localUserDid}</code><br />
                  Generate a matching snapshot with
                  <code>devctl feed --user ${this.localUserDid}</code>.
                </p>`
              : ""
          }
          ${
            this.blueskyUrl
              ? html`<a
                  class="open-in-bluesky"
                  href=${this.blueskyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  @click=${this.#notifyBlueskyFeedOpened}
                >
                  Open Bluesky app
                </a>`
              : ""
          }
        </div>
      `;
    }

    return html`
      <div class="feed-container">
        ${this.items.map(
          (item) => html`
            <feed-item-card
              .item=${item}
              .algorithmId=${this.algorithmId}
              .engagingInfluence=${this.engagingInfluence}
              .constructiveInfluence=${this.constructiveInfluence}
            ></feed-item-card>
          `,
        )}
      </div>
    `;
  }

  #formattedGeneratedAt(): string {
    if (!this.generatedAt) return "";
    const value = new Date(this.generatedAt);
    return Number.isNaN(value.getTime()) ? "" : value.toLocaleString();
  }

  #notifyBlueskyFeedOpened = (): void => {
    this.dispatchEvent(
      new CustomEvent("bluesky-feed-opened", {
        bubbles: true,
        composed: true,
        detail: { feedName: this.algorithmId },
      }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-view": FeedView;
  }
}

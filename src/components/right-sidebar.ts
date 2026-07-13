import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedSummary } from "../models/feed-debug-snapshot";
import { relativeTime } from "../utils/relative-time";

@customElement("right-sidebar")
export class RightSidebar extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;

  static styles = css`
    :host { display: block; }
    .card {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 1rem;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .card-header {
      padding: 0.75rem 1rem;
      font-weight: 800;
      font-size: 1.125rem;
      border-bottom: 1px solid var(--bluesky-border);
    }
    .feed-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      cursor: pointer;
      transition: background 0.15s;
      color: var(--bluesky-text);
      font-size: 0.9375rem;
      border-bottom: 1px solid var(--bluesky-border);
    }
    .feed-item:last-child {
      border-bottom: none;
    }
    .feed-item:hover {
      background: var(--bluesky-bg-hover);
    }
    .feed-item.active {
      font-weight: 700;
    }
    .feed-item wa-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    .feed-item.active wa-icon {
      color: var(--bluesky-brand);
    }
  `;

  render() {
    if (this.feeds.length === 0) {
      return html`
        <div style="padding: 0.5rem 0;">
          <div class="card">
            <div class="card-header">Feeds</div>
            <div class="feed-item" style="cursor: default; color: var(--bluesky-text-secondary);">
              No recent feeds
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div style="padding: 0.5rem 0;">
        <div class="card">
          <div class="card-header">Feeds</div>
          ${this.feeds.map(
            (f, index) => html`
              <div
                class="feed-item ${f.requestId === this.activeRequestId ? "active" : ""}"
                @click=${() => { this.#selectFeed(f.requestId); }}
              >
                <wa-icon name="feed-list" library="app"></wa-icon>
                <span>${index === 0 ? "Latest" : relativeTime(f.generatedAt)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  #selectFeed(requestId: string) {
    this.dispatchEvent(
      new CustomEvent("feed-select", {
        bubbles: true,
        composed: true,
        detail: { requestId },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "right-sidebar": RightSidebar;
  }
}

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedSummary } from "../models/feed-debug-snapshot";
import type { AlgorithmId } from "../constants/algorithms";
import { relativeTime } from "../utils/relative-time";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@customElement("right-sidebar")
export class RightSidebar extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;
  @property({ type: String }) selectedAlgorithm: AlgorithmId | null = null;
  @property({ type: String }) blueskyUrl: string = "";

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
    .stale-notice {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .stale-text {
      font-size: 0.875rem;
      color: var(--bluesky-text-secondary);
      line-height: 1.5;
    }
    .open-in-bluesky {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      border: 1px solid var(--bluesky-brand);
      color: var(--bluesky-brand);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
      align-self: flex-start;
    }
    .open-in-bluesky:hover {
      background: rgba(32, 139, 254, 0.1);
    }
  `;

  render() {
    const filtered = this.selectedAlgorithm
      ? this.feeds.filter((f) => f.feedName === this.selectedAlgorithm)
      : this.feeds;

    const now = Date.now();
    const hasRecent = filtered.some(
      (f) => now - new Date(f.generatedAt).getTime() < TWENTY_FOUR_HOURS_MS,
    );

    if (!hasRecent) {
      return html`
        <div style="padding: 0.5rem 0;">
          <div class="card">
            <div class="card-header">Feed Snapshots</div>
            <div class="stale-notice">
              <p class="stale-text">
                You have not refreshed this feed within the last 24 hours.
              </p>
              <a
                class="open-in-bluesky"
                href=${this.blueskyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Bluesky
              </a>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div style="padding: 0.5rem 0;">
        <div class="card">
          <div class="card-header">Feed Snapshots</div>
          ${filtered.map(
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

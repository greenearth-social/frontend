import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedSummary } from "../models/feed-debug-snapshot";
import { relativeTime } from "../utils/relative-time";

@customElement("feed-tabs")
export class FeedTabs extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .tabs-container {
      position: relative;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
    }
    .tabs-container::before,
    .tabs-container::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3rem;
      z-index: 2;
      pointer-events: none;
    }
    .tabs-container::before {
      left: 0;
      width: 1.5rem;
      background: linear-gradient(to right, rgba(21, 32, 43, 0.95) 0%, rgba(21, 32, 43, 0.7) 50%, transparent 100%);
    }
    .tabs-container::after {
      right: 0;
      background: linear-gradient(to left, rgba(21, 32, 43, 0.95) 0%, rgba(21, 32, 43, 0.7) 50%, transparent 100%);
    }
    .tabs-wrapper {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .tabs-wrapper::-webkit-scrollbar {
      display: none;
    }
    .tabs {
      display: flex;
      align-items: flex-end;
      min-width: max-content;
      padding: 0 3rem 0 0.75rem;
    }
    .tab {
      flex: 0 0 auto;
      text-align: center;
      padding: 0.75rem 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      transition: color 0.15s;
      white-space: nowrap;
      position: relative;
    }
    .tab:hover {
      background: var(--bluesky-bg-hover);
      color: var(--bluesky-text);
    }
    .tab.active {
      color: var(--bluesky-text);
      font-weight: 700;
    }
    .tab.active::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 4px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
    }
  `;

  render() {
    if (this.feeds.length === 0) return html``;

    return html`
      <div class="tabs-container">
        <div class="tabs-wrapper">
          <div class="tabs">
            ${this.feeds.map(
              (f, index) => html`
                <div
                  class="tab ${f.requestId === this.activeRequestId ? "active" : ""}"
                  @click=${() => { this.#selectTab(f.requestId); }}
                >
                  ${index === 0 ? "Latest" : relativeTime(f.generatedAt)}
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  #selectTab(requestId: string) {
    this.dispatchEvent(
      new CustomEvent("tab-change", {
        bubbles: true,
        composed: true,
        detail: { requestId },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-tabs": FeedTabs;
  }
}

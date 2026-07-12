import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

const FEEDS = [
  { icon: "feed-list", label: "Latest", route: "latest" },
  { icon: "feed-list", label: "Previous", route: "previous" },
  { icon: "feed-list", label: "2 Feeds ago", route: "2-ago" },
  { icon: "feed-list", label: "3 Feeds ago", route: "3-ago" },
  { icon: "feed-list", label: "4 Feeds ago", route: "4-ago" },
  { icon: "feed-list", label: "5 Feeds ago", route: "5-ago" },
];

@customElement("right-sidebar")
export class RightSidebar extends LitElement {
  @property({ type: String }) activeFeed = "latest";

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
    return html`
      <div style="padding: 0.5rem 0;">
        <div class="card">
          <div class="card-header">Feeds</div>
          ${FEEDS.map(
            (f) => html`
              <div class="feed-item ${f.route === this.activeFeed ? "active" : ""}" @click=${() => { this.#selectFeed(f.route); }}>
                <wa-icon name=${f.icon} library="app"></wa-icon>
                <span>${f.label}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  #selectFeed(route: string) {
    this.dispatchEvent(
      new CustomEvent("feed-select", {
        bubbles: true,
        composed: true,
        detail: { feed: route },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "right-sidebar": RightSidebar;
  }
}

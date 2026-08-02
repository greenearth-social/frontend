import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import "./feed-item-card";

@customElement("feed-view")
export class FeedView extends MobxLitElement {
  @property({ type: Array }) items: FeedItemView[] = [];
  @property({ type: String }) blueskyUrl: string = "";
  @property({ type: String }) algorithmLabel: string = "";

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
      return html`
        <div class="empty-state">
          <p class="empty-state-text">
            You have not refreshed ${label} within the last 24 hours.
          </p>
          ${this.blueskyUrl
            ? html`<a
                class="open-in-bluesky"
                href=${this.blueskyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Bluesky app
              </a>`
            : ""}
        </div>
      `;
    }

    return html`
      <div class="feed-container">
        ${this.items.map(
          (item) => html`<feed-item-card .item=${item}></feed-item-card>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-view": FeedView;
  }
}

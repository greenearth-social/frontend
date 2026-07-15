import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import "./feed-item-card";

@customElement("feed-view")
export class FeedView extends MobxLitElement {
  @property({ type: Array }) items: FeedItemView[] = [];

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
      align-items: center;
      justify-content: center;
      min-height: 400px;
      border-bottom: 1px solid var(--bluesky-border);
    }
  `;

  render() {
    if (this.items.length === 0) {
      return html`
        <div class="empty-state">
          <p class="text-xl font-bold" style="color: var(--bluesky-text)">No feed items yet</p>
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

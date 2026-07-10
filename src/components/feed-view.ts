import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import "./feed-item-card";

@customElement("feed-view")
export class FeedView extends MobxLitElement {
  @property({ type: Array }) items: FeedItemView[] = [];
  @property({ type: String }) selectedUri: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    if (this.items.length === 0) {
      return html`
        <div class="text-center py-12 text-gray-500">
          <p class="text-lg font-medium">No feed items</p>
          <p class="text-sm mt-1">Try triggering a recompute.</p>
        </div>
      `;
    }

    return html`
      <div class="space-y-3">
        ${this.items.map(
          (item) => html`
            <feed-item-card
              .item=${item}
              .expanded=${this.selectedUri === item.atUri}
              @toggle-expand=${this.#onToggle}
            ></feed-item-card>
          `,
        )}
      </div>
    `;
  }

  #onToggle(e: CustomEvent<{ uri: string }>) {
    this.dispatchEvent(
      new CustomEvent("select-item", {
        bubbles: true,
        composed: true,
        detail: { uri: e.detail.uri },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-view": FeedView;
  }
}

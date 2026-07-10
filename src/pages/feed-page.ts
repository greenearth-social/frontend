import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../components/feed-view";

@customElement("feed-page")
export class FeedPage extends MobxLitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    const store = getRootStore();
    if (!store) return html`<div class="text-center py-8 text-gray-500">Store not initialized</div>`;

    const { feedStore, uiStore, accountStore } = store;

    if (!accountStore.activeAccount) {
      return html`
        <div class="text-center py-12 text-gray-500">
          <p class="text-lg font-medium">Not signed in</p>
          <p class="text-sm mt-1">Sign in with Bluesky to view your feed debug data.</p>
        </div>
      `;
    }

    return html`
      <div class="space-y-4">
        <!-- Toolbar -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold text-gray-900">Your Feed</h1>
            ${feedStore.lastGeneratedAt
              ? html`
                  <p class="text-xs text-gray-400">
                    Generated at ${new Date(feedStore.lastGeneratedAt).toLocaleString()}
                  </p>
                `
              : ""}
          </div>
          <button
            class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            ?disabled=${feedStore.isLoading}
            @click=${() => feedStore.refreshFeed()}
          >
            ${feedStore.isLoading ? "Recomputing..." : "Recompute feed"}
          </button>
        </div>

        ${feedStore.error
          ? html`
              <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                ${feedStore.error}
              </div>
            `
          : ""}

        ${feedStore.isLoading
          ? html`
              <div class="text-center py-12 text-gray-400">
                <div
                  class="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"
                ></div>
                <p class="text-sm">Loading feed...</p>
              </div>
            `
          : html`
              <feed-view
                .items=${feedStore.items}
                .selectedUri=${uiStore.selectedItemUri}
                @select-item=${(e: CustomEvent<{ uri: string }>) => {
                  uiStore.toggleSelectedItem(e.detail.uri);
                }}
              ></feed-view>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-page": FeedPage;
  }
}

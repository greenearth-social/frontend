import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../components/feed-view";
import "../components/feed-tabs";
import "../components/pagination-control";

@customElement("feed-page")
export class FeedPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    const store = getRootStore();
    if (!store) return html`<div class="text-center py-8" style="color: var(--bluesky-text-secondary)">Store not initialized</div>`;

    const { feedStore, uiStore, accountStore, authStore } = store;

    if (!authStore.isSignedIn || !accountStore.activeAccount) {
      return html`
        <div class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div class="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4" style="background: var(--bluesky-brand)">
            G
          </div>
          <h2 class="text-xl font-extrabold" style="color: var(--bluesky-text)">Welcome to GreenEarth</h2>
          <p class="text-sm mt-2 max-w-sm" style="color: var(--bluesky-text-secondary)">
            Sign in with your Bluesky account to view your personalized feed debug data.
          </p>
          <wa-button variant="brand" size="medium" class="mt-6" @click=${this.#signIn}>
            Sign in with Bluesky
          </wa-button>
        </div>
      `;
    }

    return html`
      <div>
        <div style="width: 100%; padding-bottom: 0.5rem;">
        </div>

        <div class="sticky top-0 z-30" style="background: rgba(21, 32, 43, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--bluesky-border);">
          <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.5rem 0.5rem 1.5rem;">
            <button
              class="hamburger-btn"
              @click=${() => this.onOpenMenu?.()}
              aria-label="Open navigation"
              type="button"
              style="display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9999px; border: none; background: transparent; color: var(--bluesky-text); cursor: pointer; flex-shrink: 0;"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div style="flex: 1; min-width: 0;">
              <h1 class="text-xl font-bold" style="color: var(--bluesky-text); margin: 0;">Post Observability</h1>
              <span style="color: #22c55e; cursor: pointer; display: block; font-family: 'Nunito', 'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif; font-weight: 700; font-size: 0.9375rem; line-height: 1.2;">Why am I seeing this?</span>
            </div>
          </div>
          <style>
            @media (max-width: 1023px) {
              .hamburger-btn { display: flex !important; }
            }
          </style>
        </div>

        <feed-tabs .activeTab=${uiStore.selectedFeed} @tab-change=${(e: CustomEvent<{ tab: string }>) => { uiStore.setSelectedFeed(e.detail.tab); }}></feed-tabs>

        ${feedStore.error
          ? html`
              <div class="mx-4 mt-3">
                <wa-callout variant="danger">
                  <wa-icon name="alert-triangle" library="app" slot="icon"></wa-icon>
                  ${feedStore.error}
                </wa-callout>
              </div>
            `
          : ""}

        ${feedStore.isLoading
          ? html`
              <div class="flex flex-col items-center justify-center py-16" style="color: var(--bluesky-text-secondary)">
                <wa-spinner style="font-size: 2rem; --wa-spinner-track-width: 2px"></wa-spinner>
                <p class="text-sm mt-3">Loading feed...</p>
              </div>
            `
          : html`
              <feed-view
                .items=${feedStore.items}
                .selectedUri=${uiStore.selectedItemUri}
                @select-item=${(e: CustomEvent<{ uri: string }>) => { uiStore.toggleSelectedItem(e.detail.uri); }}
              ></feed-view>

              <pagination-control
                .currentPage=${feedStore.currentPage}
                .totalPages=${feedStore.totalPages}
                .totalItems=${feedStore.totalCount}
                .itemsPerPage=${feedStore.postsPerPage}
                @page-change=${(e: CustomEvent<{ page: number }>) => { feedStore.goToPage(e.detail.page); }}
                @per-page-change=${(e: CustomEvent<{ perPage: number }>) => { feedStore.setPostsPerPage(e.detail.perPage); }}
              ></pagination-control>
            `}
      </div>
    `;
  }

  #signIn() {
    const returnUrl = window.location.hash.slice(1) || "/feed";
    const authPath = `/auth/bluesky?return_url=${encodeURIComponent(returnUrl)}`;
    window.location.href = authPath;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-page": FeedPage;
  }
}

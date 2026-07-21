import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../components/feed-view";
import "../components/feed-tabs";
import "../components/pagination-control";

@customElement("feed-page")
export class FeedPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @state() private _showEmptyInsteadOfLoading = false;
  @state() private _loadTimer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      color: var(--bluesky-text-secondary);
    }
    .sticky-header-wrapper {
      position: sticky;
      top: 0;
      z-index: 30;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .header-section {
      border-bottom: 1px solid var(--bluesky-border);
    }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    const store = getRootStore();
    const isLoading = store?.feedStore.isLoading ?? false;

    if (changedProperties.has("_showEmptyInsteadOfLoading") || changedProperties.has("_loadTimer")) {
      return;
    }

    if (isLoading) {
      if (!this._loadTimer) {
        this._loadTimer = setTimeout(() => {
          this._showEmptyInsteadOfLoading = true;
        }, 1000);
      }
    } else {
      if (this._loadTimer) {
        clearTimeout(this._loadTimer);
        this._loadTimer = null;
      }
      this._showEmptyInsteadOfLoading = false;
    }
  }

  render() {
    const store = getRootStore();
    if (!store)
      return html`<div class="text-center py-8" style="color: var(--bluesky-text-secondary)">
        Store not initialized
      </div>`;

    const { feedStore, uiStore, accountStore, authStore } = store;
    if (!authStore.isSignedIn || !accountStore.activeAccount) {
      return html`
        <div class="logged-out-page">
          <div class="logged-out-content">
            <img src="/assets/caterpillar.png" alt="GreenEarth" class="logged-out-logo" />
            <h1 class="logged-out-title">GreenEarth</h1>
            <p class="logged-out-subtitle">Sign In to view Feed Data</p>
            <button class="logged-out-btn" @click=${this.#signIn}>Sign in with Bluesky</button>
          </div>
        </div>
        <style>
          .logged-out-page {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            min-height: 100dvh;
            width: 100%;
            padding-top: 15vh;
          }
          .logged-out-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 400px;
            width: 100%;
          }
          .logged-out-logo {
            width: 260px;
            height: auto;
            margin-bottom: -1rem;
          }
          .logged-out-title {
            font-size: 3rem;
            font-weight: 700;
            color: var(--bluesky-text);
            margin: 0 0 0.1rem 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .logged-out-subtitle {
            font-size: 1.125rem;
            color: var(--bluesky-text-secondary);
            margin: 0 0 1rem 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .logged-out-btn {
            width: 100%;
            max-width: 320px;
            padding: 0.875rem 1.5rem;
            background: var(--bluesky-brand);
            color: white;
            border: none;
            border-radius: 9999px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .logged-out-btn:hover {
            background: var(--bluesky-brand-hover);
          }
        </style>
      `;
    }

    return html`
      <div>
        <div
          class="sticky-header-wrapper"
        >
          <div
            class="header-section"
          >
            <div
              style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem 0.5rem 1rem;"
            >
              <button
                class="hamburger-btn"
                @click=${() => this.onOpenMenu?.()}
                aria-label="Open navigation"
                type="button"
                style="display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9999px; border: none; background: transparent; color: var(--bluesky-text); cursor: pointer; flex-shrink: 0;"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  style="width: 22px; height: 22px;"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div style="flex: 1; min-width: 0;">
                <h1 class="text-xl font-bold" style="color: var(--bluesky-text); margin: 0;">
                  Why Am I Seeing This?
                </h1>
              </div>
            </div>
            <style>
              @media (max-width: 1023px) {
                .hamburger-btn {
                  display: flex !important;
                }
              }
            </style>
          </div>

          <feed-tabs
            .feeds=${feedStore.feedList}
            .activeRequestId=${feedStore.currentRequestId}
            .filteringCountsByRequest=${feedStore.filteringCountsByRequest}
            @tab-change=${(e: CustomEvent<{ requestId: string }>) => {
            void feedStore.loadFeedDetail(e.detail.requestId);
          }}
          ></feed-tabs>
        </div>

        ${
          feedStore.error
            ? html`
                <div class="mx-4 mt-3">
                  <wa-callout variant="danger">
                    <wa-icon name="alert-triangle" library="app" slot="icon"></wa-icon>
                    ${feedStore.error}
                  </wa-callout>
                </div>
              `
            : ""
        }
        ${
          feedStore.isLoading && !this._showEmptyInsteadOfLoading
            ? html`
                <div
                  class="loader-container"
                  style="color: var(--bluesky-text-secondary)"
                >
                  <wa-spinner style="font-size: 2rem; --wa-spinner-track-width: 2px"></wa-spinner>
                  <p class="text-sm mt-3">Loading feed...</p>
                </div>
              `
            : feedStore.isLoading && this._showEmptyInsteadOfLoading
              ? html`
                  <div class="empty-state">
                    <p>No posts found</p>
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

                  <pagination-control
                    .currentPage=${feedStore.currentPage}
                    .totalPages=${feedStore.totalPages}
                    .totalItems=${feedStore.totalCount}
                    .itemsPerPage=${feedStore.postsPerPage}
                    @page-change=${(e: CustomEvent<{ page: number }>) => {
                    feedStore.goToPage(e.detail.page);
                  }}
                    @per-page-change=${(e: CustomEvent<{ perPage: number }>) => {
                    feedStore.setPostsPerPage(e.detail.perPage);
                  }}
                  ></pagination-control>
                `
        }
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

import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import { ALGORITHMS } from "../constants/algorithms";
import "../components/feed-view";
import "../components/feed-tabs";
import "../components/pagination-control";
import type { FeedTabs } from "../components/feed-tabs";

@customElement("feed-page")
export class FeedPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @state() private _showEmptyInsteadOfLoading = false;
  @state() private _loadTimer: ReturnType<typeof setTimeout> | null = null;
  @state() private _handle = "";
  @state() private _signInPending = false;
  @state() private _signInError = "";

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
    .header-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem 0.5rem;
    }
    .source-breakdown-button {
      display: inline-grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      min-height: 2.5rem;
      padding: 0;
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      color: var(--bluesky-text);
      background: rgba(255, 255, 255, 0.04);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .source-breakdown-button wa-icon {
      font-size: 1.25rem;
    }
    .source-breakdown-button:hover,
    .source-breakdown-button:focus-visible {
      border-color: var(--bluesky-brand);
      background: rgba(16, 131, 254, 0.12);
      outline: none;
    }
    .source-breakdown-button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    @media (max-width: 480px) {
      .header-row {
        gap: 0.5rem;
        padding-inline: 0.75rem;
      }
      .source-breakdown-button {
        width: 2.5rem;
        height: 2.5rem;
        min-height: 2.5rem;
      }
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

    if (
      changedProperties.has("_showEmptyInsteadOfLoading") ||
      changedProperties.has("_loadTimer")
    ) {
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
            <p class="logged-out-subtitle">Sign in to view Feed Controls and Transparency</p>
            <form class="sign-in-form" @submit=${this.#signIn}>
              <label class="handle-label" for="account-handle">Account handle</label>
              <input
                id="account-handle"
                class="handle-input"
                name="handle"
                type="text"
                inputmode="url"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                placeholder="alice.bsky.social"
                .value=${this._handle}
                ?disabled=${this._signInPending}
                aria-describedby=${this._signInError ? "sign-in-error" : undefined}
                @input=${(event: InputEvent) => {
                  this._handle = (event.currentTarget as HTMLInputElement).value;
                  this._signInError = "";
                }}
              />
              ${
                this._signInError
                  ? html`<p id="sign-in-error" class="sign-in-error" role="alert">
                      ${this._signInError}
                    </p>`
                  : ""
              }
              <button class="logged-out-btn" type="submit" ?disabled=${this._signInPending}>
                ${this._signInPending ? "Starting sign in..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
        <style>
          .logged-out-page {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            min-height: 100dvh;
            width: 100%;
            box-sizing: border-box;
            padding: max(1rem, 4dvh) 1rem 1.5rem;
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
            width: min(44vw, 150px);
            height: auto;
            margin-bottom: -0.5rem;
          }
          .logged-out-title {
            font-size: clamp(2rem, 10vw, 2.5rem);
            font-weight: 700;
            color: var(--bluesky-text);
            margin: 0 0 0.1rem 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .logged-out-subtitle {
            font-size: 1rem;
            color: var(--bluesky-text-secondary);
            margin: 0 0 0.875rem 0;
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
          .logged-out-btn:disabled {
            cursor: wait;
            opacity: 0.7;
          }
          .sign-in-form {
            width: 100%;
            max-width: 320px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            text-align: left;
            margin-top: 0.125rem;
          }
          .handle-label {
            color: var(--bluesky-text);
            font-size: 0.875rem;
            font-weight: 600;
            margin: 0 0 0.375rem;
          }
          .handle-input {
            box-sizing: border-box;
            width: 100%;
            border: 1px solid var(--bluesky-border);
            border-radius: 0.75rem;
            padding: 0.75rem 0.875rem;
            background: rgba(255, 255, 255, 0.06);
            color: var(--bluesky-text);
            font: inherit;
            margin-bottom: 0.875rem;
          }
          .handle-input:focus {
            border-color: var(--bluesky-brand);
            outline: 2px solid color-mix(in srgb, var(--bluesky-brand) 30%, transparent);
          }
          .sign-in-error {
            margin: 0.375rem 0 0.875rem;
            font-size: 0.8125rem;
            line-height: 1.35;
          }
          .sign-in-error {
            width: 100%;
            max-width: 320px;
            box-sizing: border-box;
            color: #ffb4ab;
            text-align: left;
          }
          @media (max-height: 560px), (max-width: 360px) {
            .logged-out-page {
              padding-top: 0.5rem;
            }
            .logged-out-logo {
              width: 96px;
              margin-bottom: -0.375rem;
            }
            .logged-out-title {
              font-size: 1.75rem;
            }
            .logged-out-subtitle {
              font-size: 0.875rem;
              margin-bottom: 0.625rem;
            }
            .logged-out-btn {
              padding-block: 0.6875rem;
            }
            .sign-in-form {
              margin-top: 0;
            }
          }
          @media (min-width: 600px) and (min-height: 720px) {
            .logged-out-page {
              padding-top: 10dvh;
            }
            .logged-out-logo {
              width: 220px;
              margin-bottom: -0.875rem;
            }
            .logged-out-title {
              font-size: 3rem;
            }
            .logged-out-subtitle {
              font-size: 1.125rem;
            }
          }
        </style>
      `;
    }

    return html`
      <div>
        <div class="sticky-header-wrapper">
          <div class="header-section">
            <div class="header-row">
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
              <button
                class="source-breakdown-button"
                type="button"
                aria-label="View source breakdown"
                title="Source breakdown"
                ?disabled=${feedStore.currentRequestId === null}
                @click=${(event: MouseEvent) => {
                  this.#showSourceBreakdown(event);
                }}
              >
                <wa-icon name="source-breakdown" library="app"></wa-icon>
              </button>
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
                <div class="loader-container" style="color: var(--bluesky-text-secondary)">
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
                    .blueskyUrl=${uiStore.selectedAlgorithm ? ALGORITHMS[uiStore.selectedAlgorithm].blueskyUrl : ""}
                    .algorithmLabel=${uiStore.selectedAlgorithm ? ALGORITHMS[uiStore.selectedAlgorithm].label : ""}
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

  async #signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this._signInPending) return;

    const handle = this._handle.trim().replace(/^@/, "").toLowerCase();
    const validHandle =
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        handle,
      );
    if (!validHandle) {
      this._signInError = "Enter a valid handle, such as alice.bsky.social.";
      return;
    }

    this._handle = handle;
    await this.#startSignIn(handle);
  }

  async #startSignIn(handle: string): Promise<void> {
    if (this._signInPending) return;
    this._signInPending = true;
    this._signInError = "";
    const returnUrl = window.location.hash.slice(1) || "/feed";
    const params = new URLSearchParams({ return_url: returnUrl, handle });
    try {
      const response = await fetch(`/auth/bluesky?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(message || "Could not start sign in");
      }
      const data = (await response.json()) as { redirectUrl?: string };
      if (!data.redirectUrl) throw new Error("The account server did not provide a sign-in URL");
      window.location.assign(data.redirectUrl);
    } catch (error: unknown) {
      this._signInError =
        error instanceof Error
          ? error.message
          : "Could not find that account. Check the handle and try again.";
      this._signInPending = false;
    }
  }

  #showSourceBreakdown(event: MouseEvent) {
    this.renderRoot.querySelector<FeedTabs>("feed-tabs")?.showActiveBreakdown(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-page": FeedPage;
  }
}

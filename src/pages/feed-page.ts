import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import { ALGORITHMS, ALGORITHM_FEED_NAME_SET, type AlgorithmId } from "../constants/algorithms";
import "../components/feed-view";
import "../components/feed-tabs";
import "../components/pagination-control";
import type { FeedTabs } from "../components/feed-tabs";

const PULL_REFRESH_THRESHOLD = 56;
const PULL_REFRESH_MAX_DISTANCE = 88;

@customElement("feed-page")
export class FeedPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @property({ type: String }) authFailureMessage = "";
  @state() private _showEmptyInsteadOfLoading = false;
  @state() private _loadTimer: ReturnType<typeof setTimeout> | null = null;
  @state() private _handle = "";
  @state() private _signInPending = false;
  @state() private _signInError = "";
  @state() private _pullDistance = 0;
  @state() private _pullTracking = false;
  @state() private _pullRefreshing = false;
  private _pullStart: { x: number; y: number } | null = null;
  private _lifecycleSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private _lifecycleSyncPromise: Promise<void> | null = null;
  private _lifecycleSyncPending = false;
  private _lifecycleSyncKey: string | null = null;

  static styles = css`
    :host {
      display: block;
      overscroll-behavior-y: contain;
    }
    .pull-refresh {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      box-sizing: border-box;
      height: 0;
      overflow: hidden;
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      transition: height 180ms ease;
    }
    .pull-refresh.tracking {
      transition: none;
    }
    .pull-refresh svg,
    .pull-refresh wa-spinner {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
    }
    .pull-refresh svg {
      fill: currentColor;
      transform: rotate(var(--pull-rotation, 0deg));
    }
    @media (max-width: 1023px) {
      .pull-refresh {
        display: flex;
      }
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
    .header-title {
      font-size: clamp(0.9375rem, 3.5vw, 1.25rem);
      font-weight: 700;
      color: var(--bluesky-text);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("focus", this.#requestLifecycleSync);
    window.addEventListener("pagehide", this.#handleFrontendLeft);
    window.addEventListener("pageshow", this.#requestLifecycleSync);
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
  }

  disconnectedCallback(): void {
    window.removeEventListener("focus", this.#requestLifecycleSync);
    window.removeEventListener("pagehide", this.#handleFrontendLeft);
    window.removeEventListener("pageshow", this.#requestLifecycleSync);
    document.removeEventListener("visibilitychange", this.#handleVisibilityChange);
    this.#cancelScheduledLifecycleSync();
    if (this._loadTimer) {
      clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    const store = getRootStore();
    const isLoading = store?.feedStore.isLoading ?? false;
    const signedInDid =
      store?.authStore.isSignedIn && store.accountStore.activeAccount
        ? store.accountStore.activeAccount.did
        : null;

    const feedName = store?.uiStore.selectedAlgorithm ?? "your-feed";
    const lifecycleSyncKey = signedInDid ? `${signedInDid}:${feedName}` : null;
    if (lifecycleSyncKey !== this._lifecycleSyncKey) {
      this._lifecycleSyncKey = lifecycleSyncKey;
      this.#cancelScheduledLifecycleSync();
      this._lifecycleSyncPending = false;
      // An activation load already fetches the newest list. Only add a
      // lifecycle check when the page becomes active with no visible load.
      if (lifecycleSyncKey && !isLoading) this.#scheduleLifecycleSync();
    }

    this.#drainLifecycleSyncQueue();

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

    const { feedStore, uiStore, accountStore, authStore, preferencesStore } = store;
    const signInError = this._signInError || this.authFailureMessage;
    if (!authStore.isSignedIn || !accountStore.activeAccount) {
      return html`
        <div class="logged-out-page">
          <div class="logged-out-content">
            <img src="/assets/caterpillar.png" alt="MySky" class="logged-out-logo" />
            <h1 class="logged-out-title">MySky</h1>
            <p class="logged-out-subtitle">Sign in to view Settings and Feed Transparency</p>
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
                aria-describedby=${signInError ? "sign-in-error" : undefined}
                @input=${(event: InputEvent) => {
                  this._handle = (event.currentTarget as HTMLInputElement).value;
                  this._signInError = "";
                  this.#dismissAuthFailure();
                }}
              />
              ${
                signInError
                  ? html`<p id="sign-in-error" class="sign-in-error" role="alert">
                      ${signInError}
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

    const selectedAlgorithm = uiStore.selectedAlgorithm ?? "your-feed";
    const selectedPreferences = preferencesStore.valuesFor(selectedAlgorithm);
    const pullReady = this._pullDistance >= PULL_REFRESH_THRESHOLD;

    return html`
      <div
        @touchstart=${this.#onPullStart}
        @touchmove=${this.#onPullMove}
        @touchend=${this.#onPullEnd}
        @touchcancel=${this.#onPullCancel}
      >
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
                <h1 class="header-title">Why Am I Seeing This?</h1>
              </div>
              ${
                uiStore.selectedAlgorithm !== "random"
                  ? html`
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
                    `
                  : ""
              }
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
            .feeds=${[...feedStore.feedList]
              .filter(
                (f) =>
                  uiStore.selectedAlgorithm === null || f.feedName === uiStore.selectedAlgorithm,
              )
              .sort((a, b) => (a.generatedAt > b.generatedAt ? -1 : 1))}
            .activeRequestId=${feedStore.currentRequestId}
            .filteringCountsByRequest=${feedStore.filteringCountsByRequest}
            .selectedAlgorithm=${uiStore.selectedAlgorithm}
            .algorithmLabel=${uiStore.selectedAlgorithm ? ALGORITHMS[uiStore.selectedAlgorithm].label : ""}
            @tab-change=${(e: CustomEvent<{ requestId: string }>) => {
              const feed = feedStore.feedList.find((f) => f.requestId === e.detail.requestId);
              if (feed && ALGORITHM_FEED_NAME_SET.has(feed.feedName)) {
                uiStore.setSelectedAlgorithm(feed.feedName as AlgorithmId);
              } else {
                uiStore.clearSelectedAlgorithm();
              }
              void feedStore.loadFeedDetail(e.detail.requestId);
            }}
          ></feed-tabs>
        </div>

        <div
          class="pull-refresh ${this._pullTracking ? "tracking" : ""}"
          style=${`height: ${String(this._pullDistance)}px; --pull-rotation: ${String(Math.min(180, this._pullDistance * 3))}deg;`}
          role="status"
          aria-live="polite"
        >
          ${
            this._pullRefreshing
              ? html`<wa-spinner></wa-spinner><span>Refreshing snapshots…</span>`
              : html`
                  <svg viewBox="0 0 640 640" aria-hidden="true">
                    <path
                      d="M320 128C426 128 512 214 512 320C512 426 426 512 320 512C254.8 512 197.1 479.5 162.4 429.7C152.3 415.2 132.3 411.7 117.8 421.8C103.3 431.9 99.8 451.9 109.9 466.4C156.1 532.6 233 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C234.3 64 158.5 106.1 112 170.7L112 144C112 126.3 97.7 112 80 112C62.3 112 48 126.3 48 144L48 256C48 273.7 62.3 288 80 288L104.6 288C105.1 288 105.6 288 106.1 288L192.1 288C209.8 288 224.1 273.7 224.1 256C224.1 238.3 209.8 224 192.1 224L153.8 224C186.9 166.6 249 128 320 128zM344 216C344 202.7 333.3 192 320 192C306.7 192 296 202.7 296 216L296 320C296 326.4 298.5 332.5 303 337L375 409C384.4 418.4 399.6 418.4 408.9 409C418.2 399.6 418.3 384.4 408.9 375.1L343.9 310.1L343.9 216z"
                    ></path>
                  </svg>
                  <span>${pullReady ? "Release to refresh" : "Pull to refresh"}</span>
                `
          }
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
          feedStore.isLoading && feedStore.items.length === 0 && !this._showEmptyInsteadOfLoading
            ? html`
                <div class="loader-container" style="color: var(--bluesky-text-secondary)">
                  <wa-spinner style="font-size: 2rem; --wa-spinner-track-width: 2px"></wa-spinner>
                  <p class="text-sm mt-3">Loading feed...</p>
                </div>
              `
            : feedStore.isLoading && feedStore.items.length === 0 && this._showEmptyInsteadOfLoading
              ? html`
                  <div class="empty-state">
                    <p>No posts found</p>
                  </div>
                `
              : html`
                  <feed-view
                    .items=${feedStore.items}
                    .selectedUri=${uiStore.selectedItemUri}
                    .algorithmId=${uiStore.selectedAlgorithm}
                    .engagingInfluence=${1 - selectedPreferences.purpose}
                    .constructiveInfluence=${selectedPreferences.purpose}
                    .blueskyUrl=${ALGORITHMS[uiStore.selectedAlgorithm ?? "your-feed"].blueskyUrl}
                    .algorithmLabel=${uiStore.selectedAlgorithm ? ALGORITHMS[uiStore.selectedAlgorithm].label : ""}
                    .localUserDid=${import.meta.env.DEV ? accountStore.activeAccount.did : ""}
                    .hasSnapshot=${feedStore.currentRequestId !== null}
                    .generatedAt=${feedStore.lastGeneratedAt ?? ""}
                    .filteringCounts=${feedStore.currentFilteringCounts}
                    .generatorDiagnostics=${feedStore.currentGeneratorDiagnostics}
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

  #onPullStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    const scrollContainer = this.parentElement;
    const feedStore = getRootStore()?.feedStore;
    if (
      !touch ||
      window.innerWidth >= 1024 ||
      (scrollContainer?.scrollTop ?? 0) > 0 ||
      feedStore?.isLoading ||
      this._pullRefreshing
    ) {
      this._pullStart = null;
      return;
    }
    this._pullStart = { x: touch.clientX, y: touch.clientY };
    this._pullTracking = true;
    this._pullDistance = 0;
  };

  #onPullMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!this._pullStart || !touch || !this._pullTracking) return;

    const deltaX = touch.clientX - this._pullStart.x;
    const deltaY = touch.clientY - this._pullStart.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      this.#resetPullGesture();
      return;
    }
    if (deltaY <= 0 || (this.parentElement?.scrollTop ?? 0) > 0) {
      this._pullDistance = 0;
      return;
    }

    if (event.cancelable) event.preventDefault();
    this._pullDistance = Math.min(PULL_REFRESH_MAX_DISTANCE, deltaY * 0.55);
  };

  #onPullEnd = (): void => {
    if (!this._pullTracking) return;
    const shouldRefresh = this._pullDistance >= PULL_REFRESH_THRESHOLD;
    this._pullStart = null;
    this._pullTracking = false;
    if (shouldRefresh) {
      void this.#refreshSelectedFeed();
    } else {
      this._pullDistance = 0;
    }
  };

  #onPullCancel = (): void => {
    this.#resetPullGesture();
  };

  #resetPullGesture(): void {
    this._pullStart = null;
    this._pullTracking = false;
    if (!this._pullRefreshing) this._pullDistance = 0;
  }

  async #refreshSelectedFeed(): Promise<void> {
    const store = getRootStore();
    if (!store || this._pullRefreshing) return;
    const feedName = store.uiStore.selectedAlgorithm ?? "your-feed";
    this._pullRefreshing = true;
    this._pullDistance = 48;
    try {
      await store.feedStore.loadFeedList({ feedName, force: true });
    } finally {
      this._pullRefreshing = false;
      this._pullDistance = 0;
    }
  }

  #handleFrontendLeft = (): void => {
    this.#cancelScheduledLifecycleSync();
  };

  #requestLifecycleSync = (): void => {
    if (document.visibilityState === "hidden") return;
    this.#scheduleLifecycleSync();
  };

  #handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.#handleFrontendLeft();
    } else {
      this.#requestLifecycleSync();
    }
  };

  #scheduleLifecycleSync(): void {
    if (this._lifecycleSyncTimer || !this.isConnected || document.visibilityState === "hidden") {
      return;
    }
    this._lifecycleSyncTimer = setTimeout(() => {
      this._lifecycleSyncTimer = null;
      void this.#runLifecycleSync();
    }, 0);
  }

  async #runLifecycleSync(): Promise<void> {
    if (!this.isConnected || document.visibilityState === "hidden") return;
    const store = getRootStore();
    if (!store?.authStore.isSignedIn || !store.accountStore.activeAccount) return;
    if (store.feedStore.isLoading || this._pullRefreshing) {
      this._lifecycleSyncPending = true;
      return;
    }
    if (this._lifecycleSyncPromise) {
      this._lifecycleSyncPending = true;
      await this._lifecycleSyncPromise;
      return;
    }

    const feedName = store.uiStore.selectedAlgorithm ?? "your-feed";
    const feedList = Array.isArray(store.feedStore.feedList) ? store.feedStore.feedList : [];
    const latestKnown = feedList
      .filter((feed) => feed.feedName === feedName)
      .reduce<(typeof feedList)[number] | undefined>(
        (best, feed) => (!best || feed.generatedAt > best.generatedAt ? feed : best),
        undefined,
      );
    this._lifecycleSyncPending = false;
    const sync = store.feedStore
      .refreshFeedIfNew(feedName, latestKnown?.requestId ?? null)
      .then(() => undefined);
    this._lifecycleSyncPromise = sync;
    try {
      await sync;
    } finally {
      if (this._lifecycleSyncPromise === sync) this._lifecycleSyncPromise = null;
      this.#drainLifecycleSyncQueue();
    }
  }

  #drainLifecycleSyncQueue(): void {
    if (!this._lifecycleSyncPending || !this.isConnected) return;
    const store = getRootStore();
    if (!store || store.feedStore.isLoading || this._pullRefreshing || this._lifecycleSyncPromise) {
      return;
    }
    this._lifecycleSyncPending = false;
    this.#scheduleLifecycleSync();
  }

  #cancelScheduledLifecycleSync(): void {
    if (this._lifecycleSyncTimer) clearTimeout(this._lifecycleSyncTimer);
    this._lifecycleSyncTimer = null;
  }

  async #signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this._signInPending) return;
    this.#dismissAuthFailure();

    const handle = this._handle.trim().replace(/^@/, "").toLowerCase();
    const validHandle =
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        handle,
      );
    if (!validHandle) {
      this._signInError = "Enter a valid handle, such as alice.bsky.social.";
      getRootStore()?.services.analyticsService.capture("signInFailed", {
        failure_stage: "validation",
        error_category: "invalid_handle",
      });
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
    let errorCategory: "request_failed" | "missing_redirect_url" = "request_failed";
    try {
      const response = await fetch(`/auth/bluesky?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const message = (await response.text()).trim();
        throw new Error(message || "Could not start sign in");
      }
      const data = (await response.json()) as { redirectUrl?: string };
      if (!data.redirectUrl) {
        errorCategory = "missing_redirect_url";
        throw new Error("The account server did not provide a sign-in URL");
      }
      window.location.assign(data.redirectUrl);
    } catch (error: unknown) {
      getRootStore()?.services.analyticsService.capture("signInFailed", {
        failure_stage: "initiation",
        error_category: errorCategory,
      });
      this._signInError =
        error instanceof Error
          ? error.message
          : "Could not find that account. Check the handle and try again.";
      this._signInPending = false;
    }
  }

  #dismissAuthFailure(): void {
    if (!this.authFailureMessage) return;
    this.dispatchEvent(
      new CustomEvent("auth-failure-dismissed", {
        bubbles: true,
        composed: true,
      }),
    );
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

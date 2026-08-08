import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import {
  ALGORITHM_IDS,
  ALGORITHMS,
  feedAnalyticsProperties,
  type AlgorithmId,
} from "../constants/algorithms";
import type { RootStore } from "../stores/root-store";
import { feedScopedPath, resolveFeedScopedRoute, type AppPage } from "../utils/app-route";
import "../pages/feed-page";
import "../pages/settings-page";
import "../pages/feedback-page";
import "../pages/not-found-page";

const NAV_ITEMS = [
  { icon: "activity", label: "Why Am I Seeing This?", page: "feed" },
  { icon: "controls", label: "Settings", page: "settings" },
  { icon: "chat", label: "Feedback", page: "feedback" },
] satisfies { icon: string; label: string; page: AppPage }[];

@customElement("app-shell")
export class AppShell extends MobxLitElement {
  private _currentRoute = "/feed";
  private _currentPage: AppPage = "feed";
  private _currentFeed: AlgorithmId = "your-feed";
  private _drawerOpen = false;
  @state() private _showLogoutMenu = false;
  @state() private _expandedAlgorithms = new Set<AlgorithmId>();
  private _lastRouteFeed: AlgorithmId | null = null;
  private _lastSettingsViewedFeed: AlgorithmId | null = null;
  private _lastResolvedAuthState: boolean | null = null;

  static styles = css`
    :host {
      display: flex;
      justify-content: center;
      height: 100dvh;
      background: var(--bluesky-bg);
      color: var(--bluesky-text);
    }

    .shell-container {
      display: flex;
      width: 100%;
      max-width: 875px;
      height: 100dvh;
      overflow: hidden;
    }

    /* ── Left sidebar ─ */
    .left-sidebar {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: var(--bluesky-nav-bg);
    }
    .left-sidebar-desktop {
      width: 72px;
    }
    @media (min-width: 1024px) {
      .left-sidebar-desktop {
        width: 275px;
      }
    }
    @media (max-width: 1023px) {
      .left-sidebar {
        display: none;
      }
    }

    .left-sidebar-inner {
      position: sticky;
      top: 0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
      width: 100%;
      overflow-x: hidden;
      overflow-y: hidden;
      padding: 0 0 0 0;
    }
    @media (min-width: 1024px) {
      .left-sidebar-inner {
        align-items: stretch;
        padding: 0;
      }
    }

    .sidebar-logo {
      width: 100%;
      border-bottom: 1px solid var(--bluesky-border);
      flex-shrink: 0;
    }
    .sidebar-logo img {
      width: 100%;
      height: auto;
      display: block;
    }

    /* ── Feed-scoped navigation ── */
    .feed-groups {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      min-width: 0;
      width: 100%;
    }
    .feed-group {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
      padding: 0.25rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.875rem;
      background: color-mix(in srgb, var(--bluesky-bg-hover) 30%, transparent);
      transition:
        border-color 0.15s,
        background-color 0.15s;
    }
    .feed-group.active-feed {
      border-color: color-mix(in srgb, var(--bluesky-brand) 55%, var(--bluesky-border));
      background: color-mix(in srgb, var(--bluesky-brand) 7%, var(--bluesky-nav-bg));
    }
    .algo-row {
      display: flex;
      align-items: center;
      min-height: 44px;
      border-radius: 0.6875rem;
      background: var(--bluesky-bg-hover);
      color: var(--bluesky-text);
      transition: background-color 0.15s;
      min-width: 0;
      width: 100%;
    }
    .algo-row:hover {
      background: var(--bluesky-bg-hover);
    }
    .algo-row.active {
      background: var(--bluesky-brand);
      color: #fff;
      font-weight: 700;
    }
    .algo-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
      padding: 0.625rem 0 0.625rem 0.75rem;
      border: none;
      background: transparent;
      color: inherit;
      text-decoration: none;
      font-size: 1.0625rem;
      cursor: pointer;
      text-align: left;
    }
    .algo-btn wa-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .algo-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .algo-toggle {
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 9999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .algo-toggle:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .algo-toggle wa-icon {
      font-size: 1rem;
      transition: transform 0.15s ease;
    }
    .algo-toggle[aria-expanded="true"] wa-icon {
      transform: rotate(180deg);
    }

    .feed-subnav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
      margin: 0.25rem 0 0;
      padding: 0.125rem 0;
    }
    .feed-subnav[hidden] {
      display: none;
    }

    .sidebar-nav-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-width: 0;
      min-height: 0;
      width: 100%;
      padding: 0.75rem 0.5rem 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
    @media (min-width: 1024px) {
      .sidebar-nav-wrapper {
        padding: 0.75rem 1.25rem 0 1rem;
      }
    }

    /* ─ Nav links ── */
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      min-height: 44px;
      min-width: 0;
      box-sizing: border-box;
      padding: 0.625rem;
      border-radius: 0.75rem;
      color: var(--bluesky-text);
      text-decoration: none;
      font-size: 0.9375rem;
      transition: background-color 0.15s;
    }
    .nav-link:hover {
      background: var(--bluesky-bg-hover);
    }
    .nav-link.active {
      background: #166534;
      color: #f0fdf4;
      font-weight: 700;
    }
    .nav-link.active:hover {
      background: #15803d;
      color: #fff;
    }
    .nav-link wa-icon {
      font-size: 1.125rem;
      flex-shrink: 0;
    }

    .nav-label {
      display: inline;
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    @media (min-width: 1024px) {
      .nav-label {
        white-space: nowrap;
        overflow-wrap: normal;
      }
    }

    .algo-btn:focus-visible,
    .algo-toggle:focus-visible,
    .nav-link:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }

    /* ── User section ─ */
    .user-section {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: auto;
      margin-bottom: 0.5rem;
      min-width: 0;
      width: 100%;
    }
    .user-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 9999px;
      border: none;
      background: transparent;
      cursor: default;
      color: var(--bluesky-text);
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .user-details {
      display: block;
      flex: 1;
      min-width: 0;
      width: 0;
      overflow: hidden;
    }

    .user-details-name {
      font-weight: 600;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      width: 100%;
      color: var(--bluesky-text);
    }

    .user-details-handle {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      width: 100%;
      color: var(--bluesky-text-secondary);
    }

    .user-details-handle--primary {
      font-size: 0.875rem;
      font-weight: 600;
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--bluesky-text-secondary);
    }

    .more-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background 0.15s;
      color: var(--bluesky-text-secondary);
      flex-shrink: 0;
      position: relative;
      z-index: 10;
    }
    .more-btn:hover {
      background: var(--bluesky-bg-hover);
      color: var(--bluesky-text);
    }
    .more-btn:active {
      background: var(--bluesky-bg-hover);
    }

    .logout-menu {
      position: absolute;
      bottom: calc(100% + 0.5rem);
      right: 0;
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      padding: 0.25rem;
      min-width: 120px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .logout-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--bluesky-danger);
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.15s;
    }
    .logout-btn:hover {
      background: rgba(244, 33, 46, 0.1);
    }
    .logout-btn wa-icon {
      font-size: 1rem;
    }

    /* ── Center column ─ */
    .center-column {
      flex: 1;
      min-width: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      box-sizing: border-box;
      border-left: 1px solid var(--bluesky-border);
      border-right: 1px solid var(--bluesky-border);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .center-column::-webkit-scrollbar {
      display: none;
    }
    @media (min-width: 768px) {
      .center-column {
        max-width: 600px;
      }
    }
    @media (min-width: 1200px) {
      .center-column {
        max-width: 600px;
      }
    }

    @media (max-width: 1023px) {
      .shell-container {
        max-width: none;
      }
      .center-column {
        max-width: none;
      }
    }

    /* ── Mobile: hamburger + drawer ── */
    .hamburger-btn {
      display: none;
    }
    @media (max-width: 767px) {
      .hamburger-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        border: none;
        background: transparent;
        color: var(--bluesky-text);
        cursor: pointer;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .hamburger-btn:hover {
        background: var(--bluesky-bg-hover);
      }
      .hamburger-btn svg {
        width: 22px;
        height: 22px;
      }
    }

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .drawer-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    .drawer {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 80;
      width: 280px;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
      background: var(--bluesky-nav-bg);
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
    .drawer.open {
      transform: translateX(0);
    }
    @media (min-width: 1024px) {
      .drawer {
        display: none;
      }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: 0;
      box-sizing: border-box;
      padding: 0.625rem 0.625rem 0.25rem;
      margin-bottom: 0;
      flex-shrink: 0;
    }
    .drawer-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      border: 1px solid var(--bluesky-border);
      background: var(--bluesky-bg-card);
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      transition:
        background-color 0.15s,
        border-color 0.15s,
        color 0.15s;
    }
    .drawer-close:hover {
      background: var(--bluesky-bg-hover);
      border-color: var(--bluesky-text-secondary);
      color: var(--bluesky-text);
    }
    .drawer-close:focus-visible {
      outline: 2px solid var(--bluesky-brand);
      outline-offset: 2px;
    }
    .drawer-close svg {
      width: 18px;
      height: 18px;
    }

    /* ── Logged-out layout ── */
    .shell-container.logged-out {
      max-width: 100%;
    }
    .center-column.logged-out-main {
      max-width: 100%;
      border-left: none;
      border-right: none;
    }
    .auth-progress {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100dvh;
      text-align: center;
    }
    .auth-progress wa-spinner {
      font-size: 2rem;
    }
    .auth-progress p {
      margin: 0.75rem 0 0;
      color: var(--bluesky-text-secondary);
      font-size: 0.875rem;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.#onHashChange);
    window.addEventListener("click", this.#onGlobalClick);
    this.addEventListener("wheel", this.#handleShellWheel, { passive: false });
    this.#updateRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.#onHashChange);
    window.removeEventListener("click", this.#onGlobalClick);
    this.removeEventListener("wheel", this.#handleShellWheel);
  }

  willUpdate(_changedProperties: Map<string, unknown>) {
    super.willUpdate(_changedProperties);
    const store = getRootStore();
    if (
      store?.authStore.isSignedIn &&
      store.feedStore.feedListLoadState === "idle" &&
      !store.feedStore.isLoading
    ) {
      void store.feedStore.loadFeedList();
    }
  }

  updated(): void {
    const root = getRootStore();
    const resolvedAuthState = root?.authStore.isInitialized ? root.authStore.isSignedIn : null;
    if (resolvedAuthState !== this._lastResolvedAuthState) {
      this._lastResolvedAuthState = resolvedAuthState;
      if (resolvedAuthState !== null) {
        this.#updateRoute();
        return;
      }
    }

    if (this._currentPage !== "settings") {
      this._lastSettingsViewedFeed = null;
      return;
    }
    const store = root;
    if (!store?.authStore.isSignedIn) return;
    if (
      store.uiStore.selectedAlgorithm === null &&
      store.feedStore.currentRequestId === null &&
      store.feedStore.feedListLoadState !== "loaded"
    ) {
      return;
    }
    const feedName = this.#selectedAlgorithmForPage(store);
    if (feedName === this._lastSettingsViewedFeed) return;
    store.services.analyticsService.capture("settingsViewed", feedAnalyticsProperties(feedName));
    this._lastSettingsViewedFeed = feedName;
  }

  render() {
    const store = getRootStore();
    if (!store)
      return html`<div class="p-8 text-center">
        <wa-callout variant="danger">Store not initialized</wa-callout>
      </div>`;

    const { authStore, accountStore } = store;
    if (!authStore.isInitialized) {
      return html`
        <div class="auth-progress">
          <div>
            <wa-spinner></wa-spinner>
            <p>Loading your account...</p>
          </div>
        </div>
      `;
    }
    const activePage: AppPage = authStore.isSignedIn ? this._currentPage : "feed";
    const selectedAlgorithm = this.#selectedAlgorithmForPage(store);

    if (this._currentRoute.startsWith("/auth/finish")) {
      return html`
        <div class="auth-progress">
          <div>
            <wa-spinner></wa-spinner>
            <p>Completing sign in...</p>
          </div>
        </div>
      `;
    }

    const authorName = accountStore.activeAccount?.displayName || "";
    const authorHandle = accountStore.activeAccount?.handle || "";
    const authorInitial = (authorHandle[0] || "?").toUpperCase();
    const showDisplayName = authorName && authorName !== authorHandle;

    return html`
      <div
        class="drawer-backdrop ${this._drawerOpen ? "open" : ""}"
        @click=${this.#closeDrawer}
      ></div>

      <aside class="drawer ${this._drawerOpen ? "open" : ""}">
        <div class="drawer-header">
          <button class="drawer-close" @click=${this.#closeDrawer} aria-label="Close navigation">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        ${this.#renderSidebarContent("drawer", authorName, authorHandle, authorInitial, Boolean(showDisplayName))}
      </aside>

      <div class="shell-container ${!authStore.isSignedIn ? "logged-out" : ""}">
        ${
          authStore.isSignedIn
            ? html`
                <aside class="left-sidebar left-sidebar-desktop hidden lg:flex">
                  <div class="left-sidebar-inner">
                    ${this.#renderSidebarContent("desktop", authorName, authorHandle, authorInitial, Boolean(showDisplayName))}
                  </div>
                </aside>
              `
            : ""
        }

        <main
          class="center-column ${!authStore.isSignedIn ? "logged-out-main" : ""}"
          @page-change=${this.#scrollToTop}
          @per-page-change=${this.#scrollToTop}
          @algo-select=${(e: CustomEvent<{ algorithmId: AlgorithmId | null }>) => {
            if (e.detail.algorithmId !== null) {
              this.#selectAlgorithm(e.detail.algorithmId);
            }
          }}
        >
          ${
            activePage === "settings"
              ? html`<settings-page
                  .onOpenMenu=${this.#openDrawer}
                  .selectedAlgorithm=${selectedAlgorithm}
                ></settings-page>`
              : activePage === "feedback"
                ? html`<feedback-page
                    .onOpenMenu=${this.#openDrawer}
                    .selectedAlgorithm=${selectedAlgorithm}
                  ></feedback-page>`
                : html`<feed-page .onOpenMenu=${this.#openDrawer}></feed-page>`
          }
        </main>
      </div>
    `;
  }

  #renderSidebarContent(
    surface: "desktop" | "drawer",
    authorName: string,
    authorHandle: string,
    authorInitial: string,
    showDisplayName: boolean,
  ) {
    const store = getRootStore();
    if (!store) return html``;

    return html`
      <div class="sidebar-nav-wrapper">
        <nav class="feed-groups" aria-label="Feed pages">
          ${ALGORITHM_IDS.map((id) => {
            const algo = ALGORITHMS[id];
            const isActiveFeed = this._currentFeed === id;
            const isExpanded = this._expandedAlgorithms.has(id);
            const subnavId = `${surface}-${id}-pages`;
            return html`
              <div
                class="feed-group ${isActiveFeed ? "active-feed" : ""} ${isExpanded ? "expanded" : ""}"
              >
                <div class="algo-row ${isActiveFeed ? "active" : ""}">
                  <button
                    class="algo-btn"
                    @click=${() => {
                      this.#navigateTo(this._currentPage, id);
                    }}
                    aria-label=${algo.label}
                    aria-pressed=${isActiveFeed}
                    type="button"
                  >
                    <wa-icon name=${algo.icon} library="app"></wa-icon>
                    <span class="algo-label">${algo.label}</span>
                  </button>
                  <button
                    class="algo-toggle"
                    type="button"
                    aria-label="${isExpanded ? "Collapse" : "Expand"} ${algo.label} pages"
                    aria-expanded=${isExpanded}
                    aria-controls=${subnavId}
                    @click=${() => {
                      this.#toggleAlgorithmExpanded(id);
                    }}
                  >
                    <wa-icon name="chevron-down" library="app"></wa-icon>
                  </button>
                </div>
                <div id=${subnavId} class="feed-subnav" ?hidden=${!isExpanded}>
                  ${NAV_ITEMS.map((item) => {
                    const isActive = isActiveFeed && this._currentPage === item.page;
                    const path = feedScopedPath(item.page, id);
                    return html`
                      <a
                        href="#${path}"
                        class="nav-link ${isActive ? "active" : ""}"
                        aria-current=${isActive ? "page" : "false"}
                        @click=${(event: MouseEvent) => {
                          event.preventDefault();
                          this.#navigateTo(item.page, id);
                        }}
                      >
                        <wa-icon name=${item.icon} library="app"></wa-icon>
                        <span class="nav-label">${item.label}</span>
                      </a>
                    `;
                  })}
                </div>
              </div>
            `;
          })}
        </nav>
        ${
          store.authStore.isSignedIn
            ? html`
                <div class="user-section">
                  <div class="user-btn">
                    <wa-avatar
                      initials=${authorInitial}
                      style="--wa-avatar-size: 40px; flex-shrink: 0;"
                    ></wa-avatar>
                    <div class="user-details">
                      ${showDisplayName ? html`<div class="user-details-name">${authorName}</div>` : ""}
                      <div
                        class="${showDisplayName ? "user-details-handle" : "user-details-handle--primary"}"
                      >
                        @${authorHandle || "unknown"}
                      </div>
                    </div>
                  </div>
                  <div style="position: relative; flex-shrink: 0;">
                    <button
                      class="more-btn"
                      @click=${this.#toggleLogoutMenu}
                      aria-label="More options"
                      type="button"
                    >
                      <wa-icon name="more-horizontal" library="app"></wa-icon>
                    </button>
                    ${
                      this._showLogoutMenu
                        ? html`
                            <div class="logout-menu">
                              <button class="logout-btn" @click=${this.#handleLogout} type="button">
                                Log out
                              </button>
                            </div>
                          `
                        : ""
                    }
                  </div>
                </div>
              `
            : ""
        }
      </div>
    `;
  }

  #onHashChange = () => {
    this.#updateRoute();
  };

  #onGlobalClick = (e: Event) => {
    const clickedLogoutControl = e
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          (target.matches(".more-btn") || target.matches(".logout-menu")),
      );
    if (!clickedLogoutControl) {
      this._showLogoutMenu = false;
    }
  };

  #updateRoute() {
    const rawHash = window.location.hash.slice(1) || "/feed";
    if (rawHash.startsWith("/auth/finish")) {
      this._currentRoute = rawHash;
      this.requestUpdate();
      void this.#handleAuthFinish();
      return;
    }

    const store = getRootStore();
    if (!store) return;

    if (!store.authStore.isInitialized) {
      this._lastResolvedAuthState = null;
      this._currentRoute = rawHash;
      this.requestUpdate();
      return;
    }

    this._lastResolvedAuthState = store.authStore.isSignedIn;

    if (!store.authStore.isSignedIn) {
      this._currentRoute = "/feed";
      this._currentPage = "feed";
      this._currentFeed = "your-feed";
      this.requestUpdate();
      if (rawHash !== "/feed") {
        window.location.hash = "/feed";
      }
      return;
    }

    const path = rawHash.split("?")[0] || "/feed";
    const route = resolveFeedScopedRoute(path, store.uiStore.selectedAlgorithm) ?? {
      page: "feed" as const,
      feedName: store.uiStore.selectedAlgorithm ?? "your-feed",
      path: feedScopedPath("feed", store.uiStore.selectedAlgorithm ?? "your-feed"),
    };
    if (path !== route.path) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#${route.path}`,
      );
    }

    this._currentRoute = route.path;
    this._currentPage = route.page;
    this._currentFeed = route.feedName;
    if (this._lastRouteFeed !== route.feedName) {
      this._expandedAlgorithms = new Set([...this._expandedAlgorithms, route.feedName]);
      this._lastRouteFeed = route.feedName;
    }
    this.#syncSelectedAlgorithm(route.feedName);
    this.requestUpdate();

    void this.updateComplete.then(() => {
      this.renderRoot.querySelector(".center-column")?.scrollTo(0, 0);
    });
  }

  #openDrawer = () => {
    this._drawerOpen = true;
    this.requestUpdate();
  };

  #scrollToTop = () => {
    this.renderRoot.querySelector(".center-column")?.scrollTo(0, 0);
  };

  #handleShellWheel = (event: WheelEvent): void => {
    if (this._drawerOpen) return;
    const center = this.renderRoot.querySelector<HTMLElement>(".center-column");
    if (!center || event.composedPath().includes(center)) return;

    const multiplier =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? center.clientHeight
          : 1;
    center.scrollTop += event.deltaY * multiplier;
    event.preventDefault();
  };

  #closeDrawer = () => {
    this._drawerOpen = false;
    this.requestUpdate();
  };

  #toggleAlgorithmExpanded(id: AlgorithmId): void {
    const expanded = new Set(this._expandedAlgorithms);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    this._expandedAlgorithms = expanded;
  }

  #navigateTo(page: AppPage, id: AlgorithmId): void {
    this._expandedAlgorithms = new Set([...this._expandedAlgorithms, id]);
    const path = feedScopedPath(page, id);
    if (window.location.hash.slice(1) !== path) {
      window.location.hash = path;
    }
    this.#updateRoute();
  }

  #selectAlgorithm = (id: AlgorithmId) => {
    this.#navigateTo(this._currentPage, id);
  };

  #syncSelectedAlgorithm(id: AlgorithmId): void {
    const store = getRootStore();
    if (!store) return;
    if (store.uiStore.selectedAlgorithm === id) return;
    store.uiStore.setSelectedAlgorithm(id);
    const matches = store.feedStore.feedList.filter((f) => f.feedName === id);
    const match = matches.reduce<(typeof matches)[0] | undefined>(
      (best, f) => (!best || f.generatedAt > best.generatedAt ? f : best),
      undefined,
    );
    if (match) {
      void store.feedStore.loadFeedDetail(match.requestId);
    } else {
      store.feedStore.clearFeedDetail();
    }
  }

  #selectedAlgorithmForPage(store: RootStore): AlgorithmId {
    return store.uiStore.selectedAlgorithm ?? this._currentFeed;
  }

  #toggleLogoutMenu = (e: Event) => {
    e.stopPropagation();
    this._showLogoutMenu = !this._showLogoutMenu;
    this.requestUpdate();
  };

  #handleLogout = async () => {
    this._showLogoutMenu = false;
    this._drawerOpen = false;
    this.requestUpdate();
    await this.updateComplete;

    const store = getRootStore();
    if (store) {
      await store.authStore.signOut();
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#/feed`,
    );
    this._currentRoute = "/feed";
    this._currentPage = "feed";
    this._currentFeed = "your-feed";
    this._lastRouteFeed = null;
    this.requestUpdate();
  };

  async #handleAuthFinish() {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const token = params.get("token");
    const returnUrl = params.get("return_url") ?? "/feed";

    if (!token) {
      getRootStore()?.services.analyticsService.capture("signInFailed", {
        failure_stage: "callback",
        error_category: "missing_token",
      });
      return;
    }

    const store = getRootStore();
    if (!store) return;

    try {
      await store.authStore.signInWithCustomToken(token);
      const user = store.authStore.currentUser ?? store.services.authService.currentUser;
      if (!user) throw new Error("Authentication completed without a user");
      store.services.analyticsService.identify(user.uid);
      const requestedReturnRoute = returnUrl.startsWith("/") ? returnUrl : "/feed";
      const routeWithoutQuery = requestedReturnRoute.split("?")[0] || "/feed";
      const sanitizedReturnRoute =
        (
          resolveFeedScopedRoute(routeWithoutQuery, store.uiStore.selectedAlgorithm) ??
          resolveFeedScopedRoute("/feed", store.uiStore.selectedAlgorithm)
        )?.path ?? "/feed/your-feed";
      store.services.analyticsService.capture("signInCompleted", {
        auth_method: "bluesky_oauth",
        return_route: sanitizedReturnRoute,
      });
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}#${sanitizedReturnRoute}`,
      );
      this.#updateRoute();
    } catch {
      store.services.analyticsService.capture("signInFailed", {
        failure_stage: "callback",
        error_category: "token_exchange_failed",
      });
      window.location.hash = "/feed";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-shell": AppShell;
  }
}

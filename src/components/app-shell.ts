import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../pages/feed-page";
import "../pages/controls-page";
import "../pages/how-it-works-page";
import "../pages/settings-page";
import "../pages/not-found-page";
import "./right-sidebar";

const NAV_ITEMS = [
  { icon: "activity", label: "Post Observability", route: "/feed" },
  { icon: "controls", label: "Feed Controls", route: "/controls" },
  { icon: "info", label: "How It Works", route: "/how-it-works" },
  { icon: "settings", label: "Settings", route: "/settings" },
];

@customElement("app-shell")
export class AppShell extends MobxLitElement {
  private _currentRoute = "/feed";
  private _drawerOpen = false;
  @state() private _showLogoutMenu = false;
  @state() private _justSignedOut = false;

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
      max-width: 1280px;
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

    .sidebar-nav-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0.75rem 0.5rem 0 0.5rem;
      overflow-y: hidden;
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
      gap: 1rem;
      padding: 0.625rem 0.75rem;
      border-radius: 9999px;
      color: var(--bluesky-text);
      text-decoration: none;
      font-size: 1.0625rem;
      transition: background-color 0.15s;
    }
    .nav-link:hover {
      background: var(--bluesky-bg-hover);
    }
    .nav-link.active {
      font-weight: 700;
    }
    .nav-link wa-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .nav-label {
      display: none;
    }
    @media (min-width: 1024px) {
      .nav-label {
        display: inline;
      }
    }
    .drawer .nav-label {
      display: inline;
    }

    /* ── User section ─ */
    .user-section {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: auto;
      margin-bottom: 0.5rem;
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
    }
    .user-details {
      display: none;
      min-width: 0;
      overflow: hidden;
    }
    @media (min-width: 1024px) {
      .user-details {
        display: block;
      }
    }
    .drawer .user-details {
      display: block;
    }

    .user-details-name {
      font-weight: 600;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--bluesky-text);
    }

    .user-details-handle {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--bluesky-text-secondary);
    }

    .user-details-handle--primary {
      font-size: 0.875rem;
      font-weight: 600;
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
      .center-column {
        max-width: none;
      }
    }

    /* ── Right sidebar ── */
    .right-sidebar {
      display: none;
    }
    @media (min-width: 1200px) {
      .right-sidebar {
        display: block;
        width: 350px;
        flex-shrink: 0;
      }
    }

    .right-sidebar-inner {
      position: sticky;
      top: 0;
      height: 100dvh;
      overflow-y: hidden;
      padding: 0.5rem 1rem 0 1rem;
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
      background: var(--bluesky-nav-bg);
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      display: flex;
      flex-direction: column;
      padding: 0;
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
      justify-content: space-between;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .drawer-close {
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
    }
    .drawer-close:hover {
      background: var(--bluesky-bg-hover);
    }
    .drawer-close svg {
      width: 20px;
      height: 20px;
    }

    @media (max-width: 767px) {
      .center-column {
        padding-top: 0.5rem;
      }
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
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.#onHashChange);
    window.addEventListener("click", this.#onGlobalClick);
    this.#updateRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.#onHashChange);
    window.removeEventListener("click", this.#onGlobalClick);
  }

  render() {
    const store = getRootStore();
    if (!store)
      return html`<div class="p-8 text-center">
        <wa-callout variant="danger">Store not initialized</wa-callout>
      </div>`;

    const { authStore, accountStore, uiStore } = store;
    const hash = window.location.hash.slice(1) || "/feed";

    if (this._currentRoute.startsWith("/auth/finish")) {
      return html`
        <div class="flex items-center justify-center flex-1 min-h-screen">
          <div class="text-center">
            <wa-spinner style="font-size: 2rem"></wa-spinner>
            <p class="text-sm text-[var(--bluesky-text-secondary)] mt-3">Completing sign in...</p>
          </div>
        </div>
      `;
    }

    const authorName =
      accountStore.activeAccount?.displayName || "";
    const authorHandle = accountStore.activeAccount?.handle || "";
    const authorInitial = (authorHandle[0] || "?").toUpperCase();
    const showDisplayName = authorName && authorName !== authorHandle;

    const sidebarContent = html`
      <div class="sidebar-nav-wrapper">
        <nav class="flex-1 flex flex-col gap-1 mt-0.5">
          ${NAV_ITEMS.map((item) => {
            const isActive = hash === item.route;
            return html`
              <a
                href="#${item.route}"
                class="nav-link ${isActive ? "active" : ""}"
                @click=${this.#closeDrawer}
              >
                <wa-icon name=${item.icon} library="app"></wa-icon>
                <span class="nav-label">${item.label}</span>
              </a>
            `;
          })}
        </nav>
        ${
          authStore.isSignedIn
            ? html`
                <div class="user-section">
                  <div class="user-btn">
                    <wa-avatar
                      initials=${authorInitial}
                      style="--wa-avatar-size: 40px; flex-shrink: 0;"
                    ></wa-avatar>
                    <div class="flex-1 min-w-0 text-left user-details">
                      ${showDisplayName ? html`<div class="user-details-name">${authorName}</div>` : ""}
                      <div class="${showDisplayName ? "user-details-handle" : "user-details-handle--primary"}">
                        @${authorHandle || "unknown"}
                      </div>
                    </div>
                  </div>
                  <div style="position: relative;">
                    <button
                      class="more-btn"
                      @click=${this.#toggleLogoutMenu}
                      aria-label="More options"
                      type="button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        style="width: 20px; height: 20px;"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                    ${
                      this._showLogoutMenu
                        ? html`
                            <div class="logout-menu">
                              <button class="logout-btn" @click=${this.#handleLogout} type="button">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  style="width: 16px; height: 16px;"
                                >
                                  <path
                                    d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                                  />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
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

    return html`
      <div
        class="drawer-backdrop ${this._drawerOpen ? "open" : ""}"
        @click=${this.#closeDrawer}
      ></div>

      <aside class="drawer ${this._drawerOpen ? "open" : ""}">
        <div class="drawer-header">
          <div class="sidebar-logo" style="width: auto; border-bottom: none; flex: 1;">
            <img src="/assets/greenearth-logo.png" alt="GreenEarth" />
          </div>
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
        ${sidebarContent}
      </aside>

      <div class="shell-container ${!authStore.isSignedIn ? "logged-out" : ""}">
        ${authStore.isSignedIn ? html`
          <aside class="left-sidebar left-sidebar-desktop hidden lg:flex">
            <div class="left-sidebar-inner">
              <div class="sidebar-logo">
                <img src="/assets/greenearth-logo.png" alt="GreenEarth" />
              </div>
              ${sidebarContent}
            </div>
          </aside>
        ` : ""}

        <main class="center-column ${!authStore.isSignedIn ? "logged-out-main" : ""}">
          ${
            this._currentRoute === "/controls"
              ? html`<controls-page .onOpenMenu=${this.#openDrawer}></controls-page>`
              : this._currentRoute === "/how-it-works"
                ? html`<how-it-works-page .onOpenMenu=${this.#openDrawer}></how-it-works-page>`
                : this._currentRoute === "/settings"
                  ? html`<settings-page .onOpenMenu=${this.#openDrawer}></settings-page>`
                  : html`<feed-page .onOpenMenu=${this.#openDrawer}></feed-page>`
          }
        </main>

        ${authStore.isSignedIn ? html`
          <aside class="right-sidebar">
            <div class="right-sidebar-inner">
              <right-sidebar
                .activeFeed=${uiStore.selectedFeed}
                @feed-select=${(e: CustomEvent<{ feed: string }>) => {
                  uiStore.setSelectedFeed(e.detail.feed);
                }}
              ></right-sidebar>
            </div>
          </aside>
        ` : ""}
      </div>
    `;
  }

  #onHashChange = () => {
    this.#updateRoute();
  };

  #onGlobalClick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".more-btn") && !target.closest(".logout-menu")) {
      this._showLogoutMenu = false;
    }
  };

  #updateRoute() {
    const hash = window.location.hash.slice(1) || "/feed";
    this._currentRoute = hash;
    this.requestUpdate();

    if (hash.startsWith("/auth/finish")) {
      void this.#handleAuthFinish();
      return;
    }

    const store = getRootStore();
    if (!store) return;

    if (!store.authStore.isSignedIn) {
      if (hash !== "/feed" && hash !== "") {
        window.location.hash = "/feed";
      }
      return;
    }

    if (hash === "/feed" || hash === "") {
      void store.feedStore.loadFeed();
    }
  }

  #openDrawer = () => {
    this._drawerOpen = true;
    this.requestUpdate();
  };

  #closeDrawer = () => {
    this._drawerOpen = false;
    this.requestUpdate();
  };

  #toggleLogoutMenu = (e: Event) => {
    e.stopPropagation();
    this._showLogoutMenu = !this._showLogoutMenu;
    this.requestUpdate();
  };

  #handleLogout = async () => {
    this._showLogoutMenu = false;
    this._justSignedOut = true;
    const store = getRootStore();
    if (store) {
      await store.authStore.signOut();
    }
    this.requestUpdate();
  };

  async #handleAuthFinish() {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const token = params.get("token");
    const returnUrl = params.get("return_url") ?? "/feed";

    if (!token) return;

    const store = getRootStore();
    if (!store) return;

    try {
      await store.authStore.signInWithCustomToken(token);
      window.location.hash = returnUrl;
    } catch {
      window.location.hash = "/feed";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-shell": AppShell;
  }
}

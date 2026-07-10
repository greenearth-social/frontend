import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../pages/feed-page";
import "../pages/not-found-page";

@customElement("app-shell")
export class AppShell extends MobxLitElement {
  private _currentRoute = "/feed";

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("hashchange", this.#onHashChange);
    this.#updateRoute();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("hashchange", this.#onHashChange);
  }

  render() {
    const store = getRootStore();
    if (!store) return html`<div class="p-8 text-center text-red-500">Store not initialized</div>`;

    const { authStore, accountStore } = store;

    return html`
      <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div class="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="#/feed" class="text-lg font-bold text-gray-900 no-underline">Feed Debug</a>
            <div class="flex items-center gap-3">
              ${authStore.isSignedIn
                ? html`
                    <span class="text-sm text-gray-600 truncate max-w-40">
                      ${accountStore.activeAccount?.handle ?? ""}
                    </span>
                    <button
                      class="text-sm text-gray-500 hover:text-gray-700"
                      @click=${() => void authStore.signOut()}
                    >
                      Sign out
                    </button>
                  `
                : html`
                    <button
                      class="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      @click=${this.#signIn}
                    >
                      Sign in with Bluesky
                    </button>
                  `}
            </div>
          </div>
        </header>

        <!-- Main content -->
        <main class="max-w-3xl mx-auto px-4 py-6">
          ${this._currentRoute.startsWith("/auth/finish")
            ? html`<div class="text-center py-12 text-gray-500"><p class="text-sm">Completing sign in...</p></div>`
            : this._currentRoute === "/feed"
              ? html`<feed-page></feed-page>`
              : html`<not-found-page></not-found-page>`}
        </main>

        <!-- Footer -->
        <footer class="max-w-3xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          GreenEarth Feed Debug — Why am I seeing this?
        </footer>
      </div>
    `;
  }

  #onHashChange = () => { this.#updateRoute(); }

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
      this.#redirectToAuth();
      return;
    }

    void store.feedStore.loadFeed();
  }

  #signIn() {
    this.#redirectToAuth();
  }

  #redirectToAuth() {
    const returnUrl = window.location.hash.slice(1) || "/feed";
    const authPath = `/auth/bluesky?return_url=${encodeURIComponent(returnUrl)}`;
    window.location.href = authPath;
  }

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

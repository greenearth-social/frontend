import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedSummary, FilteringCounts } from "../models/feed-debug-snapshot";
import { ALGORITHMS, ALGORITHM_IDS, type AlgorithmId } from "../constants/algorithms";
import { relativeTime } from "../utils/relative-time";

const ALGO_PNG: Record<string, string> = {
  "your-feed": "/assets/algo-greenearth.png",
  "best-of-friends": "/assets/algo-best-of-friends.png",
  "random": "/assets/algo-random.png",
};

@customElement("feed-tabs")
export class FeedTabs extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;
  @property({ type: Object }) filteringCountsByRequest: Record<string, FilteringCounts> = {};
  @property({ type: String }) selectedAlgorithm: string | null = null;
  @property({ type: String }) algorithmLabel: string = "";
  @state() private openBreakdownId: string | null = null;
  @state() private _algoDropdownOpen = false;

  static styles = css`
    :host {
      display: block;
    }
    .tabs-container {
      display: flex;
      align-items: stretch;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
    }
    .algo-indicator {
      display: none;
      flex-shrink: 0;
      position: relative;
      border-right: 1px solid var(--bluesky-border);
    }
    @media (max-width: 1023px) {
      .algo-indicator {
        display: block;
      }
    }
    .algo-trigger {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0 0.625rem 0 0.75rem;
      height: 100%;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--bluesky-text);
      white-space: nowrap;
      border: none;
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      transition: background 0.15s;
    }
    .algo-trigger:hover {
      background: var(--bluesky-bg-hover);
    }
    .algo-trigger img {
      width: 1.125rem;
      height: 1.125rem;
      object-fit: contain;
      flex-shrink: 0;
    }
    .algo-chevron {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
      transition: transform 0.15s;
      color: var(--bluesky-text-secondary);
    }
    .algo-chevron.open {
      transform: rotate(180deg);
    }
    .algo-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 200;
      background: rgb(21, 32, 43);
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      overflow: hidden;
      min-width: 168px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
    }
    .algo-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--bluesky-text);
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
      font: inherit;
      font-size: 0.8125rem;
    }
    .algo-option:hover {
      background: var(--bluesky-bg-hover);
    }
    .algo-option.active {
      font-weight: 700;
    }
    .algo-option img {
      width: 1rem;
      height: 1rem;
      object-fit: contain;
      flex-shrink: 0;
    }
    .tabs-scroll-area {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .tabs-scroll-area::before,
    .tabs-scroll-area::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3rem;
      z-index: 2;
      pointer-events: none;
    }
    .tabs-scroll-area::before {
      left: 0;
      width: 1.5rem;
      background: linear-gradient(to right, rgba(21, 32, 43, 0.95) 0%, rgba(21, 32, 43, 0.7) 50%, transparent 100%);
    }
    .tabs-scroll-area::after {
      right: 0;
      background: linear-gradient(to left, rgba(21, 32, 43, 0.95) 0%, rgba(21, 32, 43, 0.7) 50%, transparent 100%);
    }
    .tabs-wrapper {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .tabs-wrapper::-webkit-scrollbar {
      display: none;
    }
    .tabs {
      display: flex;
      align-items: flex-end;
      min-width: max-content;
      padding: 0 3rem 0 0.75rem;
    }
    .tab {
      flex: 0 0 auto;
      text-align: center;
      padding: 0.75rem 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      transition: color 0.15s;
      white-space: nowrap;
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .tab-algo-icon {
      width: 0.875rem;
      height: 0.875rem;
      object-fit: contain;
      flex-shrink: 0;
      opacity: 0.6;
    }
    .tab.active .tab-algo-icon {
      opacity: 1;
    }
    .tab:hover {
      background: var(--bluesky-bg-hover);
      color: var(--bluesky-text);
    }
    .tab.active {
      color: var(--bluesky-text);
      font-weight: 700;
    }
    .tab.active::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 4px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
    }
    .popover {
      position: fixed;
      top: clamp(1rem, 6vh, 4rem);
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      width: min(31rem, calc(100vw - 2rem));
      box-sizing: border-box;
      max-height: calc(100dvh - clamp(2rem, 12vh, 8rem));
      overflow: auto;
      padding: 0.9rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.75rem;
      background: rgb(21, 32, 43);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      color: var(--bluesky-text);
      margin: 0;
    }
    @media (max-width: 480px) {
      .popover {
        top: max(1rem, env(safe-area-inset-top));
        width: calc(100vw - 2rem);
        max-height: calc(100dvh - 2rem - env(safe-area-inset-top));
        padding: 1rem;
      }
    }
    .popover::backdrop {
      background: rgba(0, 0, 0, 0.58);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .popover-title {
      font-size: 0.875rem;
      font-weight: 700;
      margin-bottom: 0.2rem;
    }
    .popover-subtitle {
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .filter-summary {
      margin: 0.75rem 0;
      padding: 0.65rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      color: var(--bluesky-text-secondary);
      font-size: 0.72rem;
      line-height: 1.45;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.72rem;
    }
    th, td {
      padding: 0.4rem 0.35rem;
      text-align: right;
      border-top: 1px solid var(--bluesky-border);
      white-space: nowrap;
    }
    th:first-child, td:first-child {
      text-align: left;
    }
    .status-problem {
      color: #fbbf24;
    }
    .reason {
      display: block;
      color: var(--bluesky-text-secondary);
      white-space: normal;
      font-size: 0.67rem;
      margin-top: 0.12rem;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("click", this.#onWindowClick);
    window.addEventListener("keydown", this.#onWindowKeydown);
  }

  disconnectedCallback(): void {
    window.removeEventListener("click", this.#onWindowClick);
    window.removeEventListener("keydown", this.#onWindowKeydown);
    super.disconnectedCallback();
  }

  render() {
    if (this.feeds.length === 0) return html``;

    const pngSrc = this.selectedAlgorithm ? (ALGO_PNG[this.selectedAlgorithm] ?? "") : "";
    const indicatorLabel = this.selectedAlgorithm ? this.algorithmLabel : "Latest";

    return html`
      <div class="tabs-container">
        <div class="algo-indicator">
          <button
            class="algo-trigger"
            type="button"
            aria-haspopup="listbox"
            aria-expanded=${this._algoDropdownOpen}
            @click=${this.#toggleAlgoDropdown}
          >
            ${pngSrc ? html`<img src=${pngSrc} alt="" />` : html`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.125rem; height: 1.125rem; flex-shrink: 0;">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            `}
            <span>${indicatorLabel}</span>
            <svg
              class="algo-chevron ${this._algoDropdownOpen ? "open" : ""}"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          ${this._algoDropdownOpen ? html`
            <div class="algo-dropdown" role="listbox">
              <button
                class="algo-option ${this.selectedAlgorithm === null ? "active" : ""}"
                type="button"
                role="option"
                aria-selected=${this.selectedAlgorithm === null}
                @click=${(e: Event) => { this.#selectAlgo(null, e); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1rem; height: 1rem; flex-shrink: 0;">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                </svg>
                <span>Latest</span>
              </button>
              ${ALGORITHM_IDS.map((id) => {
                const algo = ALGORITHMS[id];
                const isActive = id === this.selectedAlgorithm;
                const png = ALGO_PNG[id] ?? "";
                return html`
                  <button
                    class="algo-option ${isActive ? "active" : ""}"
                    type="button"
                    role="option"
                    aria-selected=${isActive}
                    @click=${(e: Event) => { this.#selectAlgo(id, e); }}
                  >
                    ${png ? html`<img src=${png} alt="" />` : ""}
                    <span>${algo.label}</span>
                  </button>
                `;
              })}
            </div>
          ` : ""}
        </div>
        <div class="tabs-scroll-area">
          <div class="tabs-wrapper">
            <div class="tabs">
              ${this.feeds.map(
                (f, index) => {
                  const iconSrc = ALGO_PNG[f.feedName] ?? "";
                  return html`
                    <div
                      class="tab ${f.requestId === this.activeRequestId ? "active" : ""}"
                      @click=${() => { this.#selectTab(f.requestId); }}
                    >
                      ${iconSrc ? html`<img class="tab-algo-icon" src=${iconSrc} alt="" />` : ""}
                      <span>${index === 0 ? "Latest" : relativeTime(f.generatedAt)}</span>
                    </div>
                  `;
                },
              )}
            </div>
          </div>
        </div>
      </div>
      ${this.#renderPopover()}
    `;
  }

  #renderPopover() {
    const feed = this.feeds.find((item) => item.requestId === this.openBreakdownId);
    if (!feed) return html``;
    const radiusLabels = ["Friends", "Very close", "Closer", "Balanced", "Everyone"];
    const radius = feed.appliedSocialRadius === null
      ? "Unknown"
      : (radiusLabels[feed.appliedSocialRadius] ?? `Preset ${String(feed.appliedSocialRadius)}`);
    const filtering = this.filteringCountsByRequest[feed.requestId];
    return html`
      <dialog
        class="popover"
        aria-label="Source breakdown"
        @click=${(event: MouseEvent) => { this.#dismissFromBackdrop(event); }}
        @cancel=${(event: Event) => {
          event.preventDefault();
          this.openBreakdownId = null;
        }}
      >
        <div class="popover-title">Source breakdown</div>
        <div class="popover-subtitle">Applied social radius: ${radius}</div>
        <div class="filter-summary">
          ${filtering
            ? html`
                Snapshot stored ${filtering.storedItemCount} posts sent to Bluesky;
                ${filtering.displayedItemCount} are displayed here.
                Public labels filtered ${filtering.publiclyFilteredCount} and
                ${filtering.unavailableCount} were unavailable.
              `
            : html`Select this snapshot to calculate its displayed and filtered counts.`}
          This is a public-label approximation; private Bluesky moderation can hide additional posts.
        </div>
        ${feed.generatorDiagnostics.length === 0
          ? html`<div class="popover-subtitle">Diagnostics are unavailable for this legacy snapshot.</div>`
          : html`
              <table>
                <thead>
                  <tr><th>Source</th><th>Weight</th><th>Asked</th><th>Returned</th><th>Shown</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${feed.generatorDiagnostics.map((diagnostic) => html`
                    <tr>
                      <td>
                        ${diagnostic.name}
                      </td>
                      <td>${(diagnostic.weight * 100).toFixed(0)}%</td>
                      <td>${diagnostic.requestedCount}</td>
                      <td>${diagnostic.returnedCount}</td>
                      <td>${diagnostic.contributedCount}</td>
                      <td>
                        <span class=${diagnostic.status === "success" ? "" : "status-problem"}>${diagnostic.status}</span>
                        ${diagnostic.reason ? html`<span class="reason">${this.#reasonLabel(diagnostic.reason)} (${diagnostic.reason})</span>` : ""}
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            `}
      </dialog>
    `;
  }

  showActiveBreakdown(triggerEvent?: Event): void {
    triggerEvent?.stopPropagation();
    if (this.activeRequestId === null) return;
    this.#toggleBreakdown(this.activeRequestId);
  }

  #toggleBreakdown(requestId: string) {
    this.openBreakdownId = this.openBreakdownId === requestId ? null : requestId;
    void this.updateComplete.then(() => {
      const popover = this.renderRoot.querySelector<HTMLDialogElement>(".popover");
      if (!popover || this.openBreakdownId === null) return;
      if (typeof popover.showModal === "function") {
        popover.showModal();
      } else {
        popover.setAttribute("open", "");
      }
      popover.focus();
    });
  }

  #dismissFromBackdrop(event: MouseEvent) {
    const dialog = event.currentTarget as HTMLDialogElement;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
    if (!inside) this.openBreakdownId = null;
  }

  #reasonLabel(reason: string): string {
    return ({
      follow_lookup_failed: "Could not load followed accounts",
      no_followed_users: "No followed accounts found",
      no_recent_followed_posts: "No eligible recent posts from followed accounts",
      post_tower_not_configured: "Two-tower model is not configured",
      generator_timeout: "Generator timed out",
      generator_error: "Generator failed",
    } as Record<string, string>)[reason] ?? reason.split("_").join(" ");
  }

  #toggleAlgoDropdown = (e: Event) => {
    e.stopPropagation();
    this._algoDropdownOpen = !this._algoDropdownOpen;
  };

  #selectAlgo(id: AlgorithmId | null, e: Event) {
    e.stopPropagation();
    this._algoDropdownOpen = false;
    this.dispatchEvent(new CustomEvent("algo-select", {
      bubbles: true,
      composed: true,
      detail: { algorithmId: id },
    }));
  }

  #onWindowClick = (event: MouseEvent) => {
    if (this.openBreakdownId && !event.composedPath().includes(this)) {
      this.openBreakdownId = null;
    }
    if (this._algoDropdownOpen && !event.composedPath().includes(this)) {
      this._algoDropdownOpen = false;
    }
  };

  #onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.openBreakdownId = null;
      this._algoDropdownOpen = false;
    }
  };

  #selectTab(requestId: string) {
    this.dispatchEvent(
      new CustomEvent("tab-change", {
        bubbles: true,
        composed: true,
        detail: { requestId },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-tabs": FeedTabs;
  }
}

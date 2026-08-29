import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedSummary, FilteringCounts } from "../models/feed-debug-snapshot";
import { relativeTime } from "../utils/relative-time";
import { GENERATOR_LABELS } from "./generator-badge";

const GENERATOR_ORDER: Record<string, number> = {
  followed_users: 0,
  network_likes: 1,
  two_tower: 2,
  two_tower_empty_history: 2,
  popularity: 3,
};

@customElement("feed-tabs")
export class FeedTabs extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;
  @property({ type: Object }) filteringCountsByRequest: Record<string, FilteringCounts> = {};
  @state() private openBreakdownId: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .tabs-container {
      display: flex;
      align-items: stretch;
      min-height: 2.75rem;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
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
      background: linear-gradient(
        to right,
        rgba(21, 32, 43, 0.95) 0%,
        rgba(21, 32, 43, 0.7) 50%,
        transparent 100%
      );
    }
    .tabs-scroll-area::after {
      right: 0;
      background: linear-gradient(
        to left,
        rgba(21, 32, 43, 0.95) 0%,
        rgba(21, 32, 43, 0.7) 50%,
        transparent 100%
      );
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
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.9rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.75rem;
      background: rgb(21, 32, 43);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      color: var(--bluesky-text);
      margin: 0;
    }
    .popover::backdrop {
      background: rgba(0, 0, 0, 0.58);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .popover-title {
      font-size: 0.875rem;
      font-weight: 700;
    }
    .popover-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.2rem;
    }
    .popover-close {
      display: inline-flex;
      width: 2.25rem;
      height: 2.25rem;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      margin: -0.35rem -0.35rem -0.2rem 0;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      font: inherit;
      font-size: 1.35rem;
      line-height: 1;
    }
    .popover-close:hover,
    .popover-close:focus-visible {
      color: var(--bluesky-text);
      background: var(--bluesky-bg-hover);
      outline: none;
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
    .breakdown-table-scroll {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-x pan-y;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      scrollbar-width: thin;
      scrollbar-color: var(--bluesky-text-secondary) transparent;
    }
    .breakdown-table-scroll:focus-visible {
      outline: 2px solid var(--bluesky-brand);
      outline-offset: 2px;
    }
    .breakdown-table-scroll::-webkit-scrollbar {
      height: 0.5rem;
    }
    .breakdown-table-scroll::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 9999px;
      background: var(--bluesky-text-secondary);
      background-clip: padding-box;
    }
    .table-scroll-hint {
      display: none;
      margin: 0 0 0.35rem;
      color: var(--bluesky-text-secondary);
      font-size: 0.6875rem;
    }
    table {
      width: max(100%, 35rem);
      border-collapse: collapse;
      font-size: 0.72rem;
    }
    th,
    td {
      padding: 0.4rem 0.35rem;
      text-align: right;
      border-top: 1px solid var(--bluesky-border);
      white-space: nowrap;
    }
    th:first-child,
    td:first-child {
      position: sticky;
      left: 0;
      z-index: 1;
      text-align: left;
      background: rgb(21, 32, 43);
      box-shadow: 0.55rem 0 0.75rem -0.75rem rgba(255, 255, 255, 0.55);
    }
    thead th:first-child {
      z-index: 2;
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
    @media (max-width: 480px) {
      .popover {
        top: max(0.5rem, env(safe-area-inset-top));
        width: calc(100vw - 0.75rem);
        max-height: calc(100dvh - 1rem - env(safe-area-inset-top));
        padding: 0.75rem;
        border-radius: 0.625rem;
      }

      .filter-summary {
        margin-block: 0.625rem;
        padding: 0.55rem;
      }

      .table-scroll-hint {
        display: block;
      }

      .popover-close {
        width: 2.75rem;
        height: 2.75rem;
      }
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
    return html`
      <div class="tabs-container">
        <div class="tabs-scroll-area">
          <div class="tabs-wrapper">
            <div class="tabs">
              ${this.feeds.map((f, index) => {
                return html`
                  <div
                    class="tab ${f.requestId === this.activeRequestId ? "active" : ""}"
                    @click=${() => {
                      this.#selectTab(f.requestId);
                    }}
                  >
                    <span>${index === 0 ? "Latest" : relativeTime(f.generatedAt)}</span>
                  </div>
                `;
              })}
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
    const radius =
      feed.appliedSocialRadius === null
        ? "Unknown"
        : (radiusLabels[feed.appliedSocialRadius] ?? `Preset ${String(feed.appliedSocialRadius)}`);
    const sourceNames: Record<string, string> = {
      followed_users: "Following",
      two_tower: "Authors/Topics",
      two_tower_empty_history: "Authors/Topics",
      popularity: "Popular",
    };
    const sourceMix = feed.generatorDiagnostics
      .filter((diagnostic) => sourceNames[diagnostic.name] !== undefined)
      .map(
        (diagnostic) =>
          `${sourceNames[diagnostic.name] ?? diagnostic.name} ${(diagnostic.weight * 100).toFixed(0)}%`,
      )
      .join(" · ");
    const filtering = this.filteringCountsByRequest[feed.requestId];
    return html`
      <dialog
        class="popover"
        aria-label="Source breakdown"
        @click=${(event: MouseEvent) => {
          this.#dismissFromBackdrop(event);
        }}
        @cancel=${(event: Event) => {
          event.preventDefault();
          this.openBreakdownId = null;
        }}
      >
        <div class="popover-heading">
          <div class="popover-title">Source breakdown</div>
          <button
            class="popover-close"
            type="button"
            aria-label="Close source breakdown"
            @click=${() => {
              this.openBreakdownId = null;
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="popover-subtitle">
          ${sourceMix ? `Applied source mix: ${sourceMix}` : `Legacy social radius: ${radius}`}
        </div>
        <div class="filter-summary">
          ${
            filtering
              ? html`
                  Snapshot stored ${filtering.storedItemCount} posts sent to Bluesky;
                  ${filtering.displayedItemCount} are displayed here. Public labels filtered
                  ${filtering.publiclyFilteredCount} and ${filtering.unavailableCount} were
                  unavailable.
                `
              : html`Select this snapshot to calculate its displayed and filtered counts.`
          }
          This is a public-label approximation; private Bluesky moderation can hide additional
          posts.
        </div>
        ${
          feed.generatorDiagnostics.length === 0
            ? html`<div class="popover-subtitle">
                Diagnostics are unavailable for this legacy snapshot.
              </div>`
            : html`
                <p class="table-scroll-hint">Swipe horizontally to see all columns</p>
                <div
                  class="breakdown-table-scroll"
                  tabindex="0"
                  role="region"
                  aria-label="Source diagnostics table"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Weight</th>
                        <th>Asked</th>
                        <th>Returned</th>
                        <th>Shown</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${[...feed.generatorDiagnostics]
                        .sort(
                          (a, b) =>
                            (GENERATOR_ORDER[a.name] ?? Number.MAX_SAFE_INTEGER) -
                            (GENERATOR_ORDER[b.name] ?? Number.MAX_SAFE_INTEGER),
                        )
                        .map(
                          (diagnostic) => html`
                            <tr>
                              <td>${GENERATOR_LABELS[diagnostic.name] ?? diagnostic.name}</td>
                              <td>${(diagnostic.weight * 100).toFixed(0)}%</td>
                              <td>${diagnostic.requestedCount}</td>
                              <td>${diagnostic.returnedCount}</td>
                              <td>${diagnostic.contributedCount}</td>
                              <td>
                                <span
                                  class=${diagnostic.status === "success" ? "" : "status-problem"}
                                  >${diagnostic.status}</span
                                >
                                ${diagnostic.reason ? html`<span class="reason">${this.#reasonLabel(diagnostic.reason)} (${diagnostic.reason})</span>` : ""}
                              </td>
                            </tr>
                          `,
                        )}
                    </tbody>
                  </table>
                </div>
              `
        }
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
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) this.openBreakdownId = null;
  }

  #reasonLabel(reason: string): string {
    return (
      (
        {
          follow_lookup_failed: "Could not load followed accounts",
          no_followed_users: "No followed accounts found",
          no_recent_followed_posts: "No eligible recent posts from followed accounts",
          post_tower_not_configured: "Two-tower model is not configured",
          generator_timeout: "Generator timed out",
          generator_error: "Generator failed",
        } as Record<string, string>
      )[reason] ?? reason.split("_").join(" ")
    );
  }

  #onWindowClick = (event: MouseEvent) => {
    if (this.openBreakdownId && !event.composedPath().includes(this)) {
      this.openBreakdownId = null;
    }
  };

  #onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.openBreakdownId = null;
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

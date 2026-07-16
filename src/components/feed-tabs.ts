import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedSummary } from "../models/feed-debug-snapshot";
import { relativeTime } from "../utils/relative-time";

@customElement("feed-tabs")
export class FeedTabs extends LitElement {
  @property({ type: Array }) feeds: FeedSummary[] = [];
  @property({ type: String }) activeRequestId: string | null = null;
  @state() private openBreakdownId: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .tabs-container {
      position: relative;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
    }
    .tabs-container::before,
    .tabs-container::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3rem;
      z-index: 2;
      pointer-events: none;
    }
    .tabs-container::before {
      left: 0;
      width: 1.5rem;
      background: linear-gradient(to right, rgba(21, 32, 43, 0.95) 0%, rgba(21, 32, 43, 0.7) 50%, transparent 100%);
    }
    .tabs-container::after {
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
    .breakdown-button {
      display: inline-grid;
      place-items: center;
      width: 1.35rem;
      height: 1.35rem;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      color: var(--bluesky-text-secondary);
      background: transparent;
      cursor: pointer;
      font: inherit;
    }
    .breakdown-button:hover,
    .breakdown-button:focus-visible {
      color: var(--bluesky-text);
      background: rgba(255, 255, 255, 0.1);
      outline: none;
    }
    .popover {
      position: fixed;
      top: clamp(1rem, 6vh, 4rem);
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      width: min(31rem, calc(100vw - 1.5rem));
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

    return html`
      <div class="tabs-container">
        <div class="tabs-wrapper">
          <div class="tabs">
            ${this.feeds.map(
              (f, index) => html`
                <div
                  class="tab ${f.requestId === this.activeRequestId ? "active" : ""}"
                  @click=${() => { this.#selectTab(f.requestId); }}
                >
                  <span>${index === 0 ? "Latest" : relativeTime(f.generatedAt)}</span>
                  <button
                    class="breakdown-button"
                    aria-label="Source breakdown for ${index === 0 ? "latest feed" : relativeTime(f.generatedAt)}"
                    aria-expanded=${this.openBreakdownId === f.requestId ? "true" : "false"}
                    @click=${(event: MouseEvent) => {
                      event.stopPropagation();
                      this.#toggleBreakdown(f.requestId, event.currentTarget as HTMLElement);
                    }}
                  >ⓘ</button>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
      ${this.#renderPopover()}
    `;
  }

  #renderPopover() {
    const feed = this.feeds.find((item) => item.requestId === this.openBreakdownId);
    if (!feed) return html``;
    const radiusLabels = ["Friends", "Closer", "Balanced", "Broader", "Everyone"];
    const radius = feed.appliedSocialRadius === null
      ? "Unknown"
      : (radiusLabels[feed.appliedSocialRadius] ?? `Preset ${String(feed.appliedSocialRadius)}`);
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
                      <td>${diagnostic.name}</td>
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

  #toggleBreakdown(requestId: string, _anchor: HTMLElement) {
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

  #onWindowClick = (event: MouseEvent) => {
    if (this.openBreakdownId && !event.composedPath().includes(this)) {
      this.openBreakdownId = null;
    }
  };

  #onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.openBreakdownId = null;
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

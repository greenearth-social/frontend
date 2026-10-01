import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ALGORITHMS } from "../constants/algorithms";
import type { AlgorithmId } from "../constants/algorithms";
import "../components/feedback-form";

@customElement("feedback-page")
export class FeedbackPage extends LitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @property({ type: String }) selectedAlgorithm: AlgorithmId = "your-feed";

  static styles = css`
    :host {
      display: block;
      min-height: 100%;
    }
    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 30;
      border-bottom: 1px solid var(--bluesky-border);
      backdrop-filter: var(--theme-header-blur);
      -webkit-backdrop-filter: var(--theme-header-blur);
    }
    .header-row {
      display: flex;
      /* the 1px is the header's own bottom line */
      min-height: calc(var(--theme-header-height) - 1px);
      box-sizing: border-box;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1.5rem;
    }
    h1 {
      flex: 1;
      margin: 0;
      color: var(--theme-title-color);
      font-size: 1.25rem;
      font-weight: 700;
    }
    h1 > span {
      display: inline-block;
      padding: var(--theme-title-bubble-padding);
      border-radius: var(--theme-radius-pill);
      background: var(--theme-title-bubble-bg);
      backdrop-filter: var(--theme-glass-blur);
      -webkit-backdrop-filter: var(--theme-glass-blur);
    }
    .title-logo {
      width: 1.8em;
      height: 1.8em;
      margin-block: -0.3em;
      flex: none;
    }
    .title-text {
      background: var(--theme-title-gradient);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .hamburger-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--bluesky-text);
      cursor: pointer;
    }
    .hamburger-btn:hover,
    .hamburger-btn:focus-visible {
      background: var(--bluesky-bg-hover);
    }
    .hamburger-btn svg {
      width: 22px;
      height: 22px;
    }
    .content {
      padding: 1.5rem;
    }
    @media (max-width: 1023px) {
      .hamburger-btn {
        display: flex;
      }
    }
  `;

  render() {
    return html`
      <div class="sticky-header">
        <div class="header-row">
          <button
            class="hamburger-btn"
            @click=${() => {
              this.onOpenMenu?.();
            }}
            aria-label="Open navigation"
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
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1>
            <span>
              <img class="title-logo" src="/assets/mysky-small.png" alt="" />
              <span class="title-text">Feedback</span>
            </span>
          </h1>
        </div>
      </div>
      <div class="content">
        <feedback-form
          surface="general"
          .selectedFeed=${this.selectedAlgorithm}
          .prompt=${`We'd love to know what you think of ${ALGORITHMS[this.selectedAlgorithm].label}`}
          placeholder="Share your feedback"
        ></feedback-form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feedback-page": FeedbackPage;
  }
}

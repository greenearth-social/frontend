import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../components/lifecycle-slider";

interface SliderConfig {
  title: string;
  leftLabel: string;
  rightLabel: string;
}

const SLIDERS: SliderConfig[] = [
  { title: "Social Radius", leftLabel: "Friends", rightLabel: "Everyone" },
  { title: "Politics", leftLabel: "Less", rightLabel: "Most" },
  { title: "Freshness", leftLabel: "Hours", rightLabel: "Days" },
  { title: "Purpose", leftLabel: "Engaging", rightLabel: "Constructive" },
];

@customElement("controls-page")
export class ControlsPage extends LitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @state() private sliderValues: number[] = [2, 0, 0, 0];
  @state() private isLoading = true;

  static styles = css`
    :host {
      display: block;
    }
    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 30;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
    }
    .controls-content {
      padding: 1.5rem;
    }
    .slider-group {
      margin-bottom: 0.5rem;
    }
    .slider-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--bluesky-text);
      margin-bottom: 0.75rem;
      padding-left: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .coming-soon {
      font-size: 0.75rem;
      font-weight: 400;
      font-style: italic;
      color: var(--bluesky-text-secondary);
    }
    .slider-placeholder {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      height: 48px;
      margin-bottom: 1.5rem;
    }
  `;

  firstUpdated() {
    const root = getRootStore();
    if (!root) return;
    void root.services.feedApiService.getPreferences().then(
      (pref) => { this.sliderValues = [pref.socialRadius, 0, 0, 0]; },
      () => {},
    ).finally(() => { this.isLoading = false; });
  }

  render() {
    return html`
      <div class="sticky-header">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.5rem;">
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
          <h1 class="text-xl font-bold" style="color: var(--bluesky-text); margin: 0; flex: 1;">
            Feed Controls
          </h1>
        </div>
        <style>
          @media (max-width: 1023px) {
            .hamburger-btn {
              display: flex !important;
            }
          }
        </style>
      </div>
      <div class="controls-content">
        ${SLIDERS.map(
          (slider, index) => html`
            <div class="slider-group">
              <div class="slider-title">
                ${slider.title}
                ${index > 0 ? html`<span class="coming-soon">Coming Soon!</span>` : ""}
              </div>
              ${this.isLoading
                ? html`<div class="slider-placeholder"></div>`
                : html`
                    <lifecycle-slider
                      title=${slider.title}
                      leftLabel=${slider.leftLabel}
                      rightLabel=${slider.rightLabel}
                      value=${this.sliderValues[index]}
                      ?disabled=${index > 0}
                      @slider-change=${(e: CustomEvent<{ value: number }>) => {
                        this.#handleSliderChange(index, e.detail.value);
                      }}
                    ></lifecycle-slider>
                  `
              }
            </div>
          `,
        )}
      </div>
    `;
  }

  #handleSliderChange(index: number, value: number) {
    const newValues = [...this.sliderValues];
    newValues[index] = value;
    this.sliderValues = newValues;

    if (index === 0) {
      const root = getRootStore();
      root?.services.feedApiService.putPreferences(value).catch(console.warn);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "controls-page": ControlsPage;
  }
}

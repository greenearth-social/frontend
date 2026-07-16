import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import "../components/lifecycle-slider";
import "../components/discrete-slider";
import {
  FRESHNESS_PRESETS,
  POLITICS_PRESETS,
  PURPOSE_PRESETS,
  SOCIAL_RADIUS_PRESETS,
} from "../constants/preferences";

type ControlHelp = "social-radius" | "freshness" | "politics" | "purpose";

const HELP_CONTENT: Record<ControlHelp, {
  title: string;
  paragraphs: Array<{ label?: string; text: string }>;
}> = {
  "social-radius": {
    title: "Social Radius",
    paragraphs: [
      { label: "F (Following)", text: "Posts from accounts you follow." },
      { label: "E (Everyone)", text: "Posts discovered beyond accounts you follow." },
      { text: "Everyone is split evenly between Author/Topic recommendations and Popular posts, so each source receives half of the displayed Everyone weight." },
    ],
  },
  freshness: {
    title: "Freshness",
    paragraphs: [
      { text: "Controls the maximum age of posts considered for your feed, from 6 hours through 7 days." },
    ],
  },
  politics: {
    title: "Politics",
    paragraphs: [
      { text: "Controls the score multiplier applied to political content." },
      { text: "1.00 is neutral. Lower values reduce political-content scores; higher values increase them." },
    ],
  },
  purpose: {
    title: "Purpose",
    paragraphs: [
      { label: "E (Engaging)", text: "Weight for content that drives interaction, such as likes and replies." },
      { label: "C (Constructive)", text: "Weight for healthy, meaningful content." },
      { text: "E and C always sum to 1.00." },
    ],
  },
};

@customElement("controls-page")
export class ControlsPage extends LitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @state() private isLoading = true;
  @state() private activeHelp: ControlHelp | null = null;

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
      margin-bottom: 2rem;
    }
    .slider-group.disabled-control .slider-title > :not(.help-button) {
      opacity: 0.4;
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
    .slider-placeholder {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      height: 48px;
      margin-bottom: 1.5rem;
    }
    .help-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 0.875rem;
      color: var(--bluesky-text-secondary);
      transition: color 0.15s;
    }
    .help-button:hover,
    .help-button:focus-visible {
      color: var(--bluesky-brand);
    }
    .coming-soon {
      font-size: 0.6875rem;
      font-weight: 600;
      font-style: italic;
      color: var(--bluesky-text-secondary);
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      z-index: 100;
    }
    .info-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      padding: 1rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--bluesky-text);
      width: 320px;
      max-width: 90vw;
      z-index: 101;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .info-popup-title {
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--bluesky-text);
    }
    .info-popup p {
      margin: 0.5rem 0 0;
    }
  `;

  firstUpdated() {
    const root = getRootStore();
    if (!root) {
      this.isLoading = false;
      return;
    }
    void root.preferencesStore.load().finally(() => {
      this.isLoading = false;
    });
  }

  render() {
    const root = getRootStore();
    const prefs = root?.preferencesStore.values ?? {
      socialRadius: 2,
      freshness: 2,
      politics: 1.0,
      purpose: 0.5,
    };

    return html`
      ${this.activeHelp
        ? html`<div class="backdrop" @click=${() => { this.activeHelp = null; }}></div>`
        : ""}
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
        <div class="slider-group">
          <div class="slider-title">
            <span>Social Radius</span>
            ${this.#helpButton("social-radius", "Social Radius")}
          </div>
          ${this.isLoading
            ? html`<div class="slider-placeholder"></div>`
            : html`
                <lifecycle-slider
                  title="Social Radius"
                  leftLabel="Friends"
                  rightLabel="Everyone"
                  value=${prefs.socialRadius}
                  .stageLabels=${SOCIAL_RADIUS_PRESETS.map((preset) => preset.displayLines)}
                  @slider-change=${(e: CustomEvent<{ value: number }>) => {
                    this.#handleSocialRadiusChange(e.detail.value);
                  }}
                ></lifecycle-slider>
              `}
        </div>

        <div class="slider-group disabled-control">
          <div class="slider-title">
            <span>Freshness</span>
            <span class="coming-soon">Coming Soon!</span>
            ${this.#helpButton("freshness", "Freshness")}
          </div>
          ${this.isLoading
            ? html`<div class="slider-placeholder"></div>`
            : html`
                <discrete-slider
                  .options=${FRESHNESS_PRESETS.map((p) => p.label)}
                  value=${prefs.freshness}
                  disabled
                  @slider-change=${(e: CustomEvent<{ value: number }>) => {
                    this.#handleFreshnessChange(e.detail.value);
                  }}
                ></discrete-slider>
              `}
        </div>

        <div class="slider-group disabled-control">
          <div class="slider-title">
            <span>Politics</span>
            <span class="coming-soon">Coming Soon!</span>
            ${this.#helpButton("politics", "Politics")}
          </div>
          ${this.isLoading
            ? html`<div class="slider-placeholder"></div>`
            : html`
                <lifecycle-slider
                  value=${2}
                  .stageLabels=${POLITICS_PRESETS.map((preset) => preset.displayLines)}
                  disabled
                  @slider-change=${(e: CustomEvent<{ value: number }>) => {
                    const preset = POLITICS_PRESETS[e.detail.value];
                    if (preset) this.#handlePoliticsChange(preset.value);
                  }}
                ></lifecycle-slider>
              `}
        </div>

        <div class="slider-group disabled-control">
          <div class="slider-title">
            <span>Purpose</span>
            <span class="coming-soon">Coming Soon!</span>
            ${this.#helpButton("purpose", "Purpose")}
          </div>
          ${this.isLoading
            ? html`<div class="slider-placeholder"></div>`
            : html`
                <lifecycle-slider
                  value=${2}
                  .stageLabels=${PURPOSE_PRESETS.map((preset) => preset.displayLines)}
                  disabled
                  @slider-change=${(e: CustomEvent<{ value: number }>) => {
                    const preset = PURPOSE_PRESETS[e.detail.value];
                    if (preset) this.#handlePurposeChange(preset.value);
                  }}
                ></lifecycle-slider>
              `}
        </div>
      </div>

      ${this.activeHelp
        ? html`
            <div class="info-popup" role="dialog" aria-modal="true" aria-labelledby="help-title">
              <div class="info-popup-title" id="help-title">
                ${HELP_CONTENT[this.activeHelp].title}
              </div>
              ${HELP_CONTENT[this.activeHelp].paragraphs.map(
                (paragraph) => html`
                  <p>
                    ${paragraph.label ? html`<strong>${paragraph.label}:</strong> ` : ""}
                    ${paragraph.text}
                  </p>
                `,
              )}
            </div>
          `
        : ""}
    `;
  }

  #helpButton(control: ControlHelp, label: string) {
    return html`
      <button
        class="help-button"
        type="button"
        aria-label="Explain ${label}"
        @click=${(e: Event) => {
          e.stopPropagation();
          this.activeHelp = control;
        }}
      >
        <wa-icon name="info-circle" library="app"></wa-icon>
      </button>
    `;
  }

  #handleSocialRadiusChange(value: number) {
    const root = getRootStore();
    if (!root) return;
    const newPrefs = { ...root.preferencesStore.values, socialRadius: value };
    void root.preferencesStore.save(newPrefs);
  }

  #handleFreshnessChange(value: number) {
    const root = getRootStore();
    if (!root) return;
    const newPrefs = { ...root.preferencesStore.values, freshness: value };
    void root.preferencesStore.save(newPrefs);
  }

  #handlePoliticsChange(value: number) {
    const root = getRootStore();
    if (!root) return;
    const newPrefs = { ...root.preferencesStore.values, politics: value };
    void root.preferencesStore.save(newPrefs);
  }

  #handlePurposeChange(value: number) {
    const root = getRootStore();
    if (!root) return;
    const newPrefs = { ...root.preferencesStore.values, purpose: value };
    void root.preferencesStore.save(newPrefs);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "controls-page": ControlsPage;
  }
}

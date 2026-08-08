import { html, type TemplateResult } from "lit";
import { MobxLitElement } from "@adobe/lit-mobx";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import type { AlgorithmId } from "../constants/algorithms";
import { feedAnalyticsProperties } from "../constants/algorithms";
import { FRESHNESS_PRESETS } from "../constants/preferences";
import type { SourceWeights } from "../services/types";
import { DEFAULT_PREFERENCES } from "../stores/preferences-store";
import {
  applySourceLocks,
  blendSourceWeightsToRank,
  redistributeSourceWeights,
  SOURCE_RANK_MAX,
  sourceRankPosition,
  sourceRankValueText,
  sourceWeightRange,
  type SourceWeightKey,
} from "../utils/source-weight-math";
import "../components/icon-range-slider";
import "../components/feedback-form";
import { renderSettingsDetailDialog } from "./settings-detail-dialog";
import { settingsPageStyles } from "./settings-page.styles";
import {
  LIFECYCLE_ICONS,
  LOCKED_ICON_PATH,
  SETTINGS_NODES,
  UNLOCKED_ICON_PATH,
} from "./settings-page-config";

@customElement("settings-page")
export class SettingsPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @property({ type: String }) selectedAlgorithm: AlgorithmId = "your-feed";
  @state() private isLoading = true;
  @state() private selectedNode: string | null = null;
  @state() private previewSourceWeights: SourceWeights | null = null;
  @state() private previewPurpose: number | null = null;
  @state() private previewFreshness: number | null = null;
  @state() private showRefreshPopup = false;
  @state() private refreshPopupMessage = "Refresh your Bluesky feed to see updates!";
  @state() private isResetting = false;
  @state() private lockedSources: SourceWeightKey[] = [];
  private masterStartWeights: SourceWeights | null = null;
  private sourceStartWeights: SourceWeights | null = null;
  private refreshPopupTimer: ReturnType<typeof setTimeout> | null = null;

  static styles = settingsPageStyles;

  disconnectedCallback(): void {
    if (this.refreshPopupTimer) clearTimeout(this.refreshPopupTimer);
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    const root = getRootStore();
    if (!root) {
      this.isLoading = false;
      return;
    }
    void root.preferencesStore.load().finally(() => {
      this.isLoading = false;
    });
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("selectedAlgorithm")) {
      this.previewSourceWeights = null;
      this.previewPurpose = null;
      this.previewFreshness = null;
      this.masterStartWeights = null;
      this.sourceStartWeights = null;
      this.lockedSources = [];
      this.selectedNode = null;
    }
  }

  render() {
    const root = getRootStore();
    const preferences = root?.preferencesStore.valuesFor(this.selectedAlgorithm) ?? {
      sourceWeights: {
        following: 0.3,
        networkLikes: 0.2,
        authorsTopics: 0.25,
        popular: 0.25,
      },
      freshness: 5,
      purpose: 0.5,
      politics: 1,
    };
    const weights = this.previewSourceWeights ?? preferences.sourceWeights;
    const purpose = this.previewPurpose ?? preferences.purpose;
    const freshness = this.previewFreshness ?? preferences.freshness;
    const isAtDefaults = this.#isAtDefaults(preferences);

    return html`
      <div class="sticky-header">
        <div class="header-row">
          <button
            class="hamburger-btn"
            type="button"
            aria-label="Open navigation"
            @click=${() => {
              this.onOpenMenu?.();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1>Settings</h1>
          <button
            class="reset-defaults-btn"
            type="button"
            aria-label="Reset settings to defaults"
            ?disabled=${this.isLoading || this.isResetting || isAtDefaults}
            @click=${() => {
              this.#restoreDefaults();
            }}
          >
            <svg viewBox="0 0 640 640" aria-hidden="true">
              <path
                d="M320 128C426 128 512 214 512 320C512 426 426 512 320 512C254.8 512 197.1 479.5 162.4 429.7C152.3 415.2 132.3 411.7 117.8 421.8C103.3 431.9 99.8 451.9 109.9 466.4C156.1 532.6 233 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C234.3 64 158.5 106.1 112 170.7L112 144C112 126.3 97.7 112 80 112C62.3 112 48 126.3 48 144L48 256C48 273.7 62.3 288 80 288L104.6 288C105.1 288 105.6 288 106.1 288L192.1 288C209.8 288 224.1 273.7 224.1 256C224.1 238.3 209.8 224 192.1 224L153.8 224C186.9 166.6 249 128 320 128zM344 216C344 202.7 333.3 192 320 192C306.7 192 296 202.7 296 216L296 320C296 326.4 298.5 332.5 303 337L375 409C384.4 418.4 399.6 418.4 408.9 409C418.2 399.6 418.3 384.4 408.9 375.1L343.9 310.1L343.9 216z"
              ></path>
            </svg>
            <span class="reset-label-long">Reset defaults</span>
            <span class="reset-label-short">Defaults</span>
          </button>
        </div>
      </div>

      <div class="page-content">
        ${
          this.showRefreshPopup
            ? html`<div class="refresh-popup" role="status" aria-live="polite">
                ${this.refreshPopupMessage}
              </div>`
            : ""
        }
        <div class="diagram-wrapper">
          ${this.#renderCandidateSection(weights, freshness)}
          ${
            this.selectedAlgorithm === "random"
              ? ""
              : html`
                  ${this.#renderArrow()} ${this.#renderRankingSection(purpose)}
                  ${this.#renderArrow()} ${this.#renderDiversificationSection()}
                `
          }
        </div>

        ${this.#renderPolitics()}

        <feedback-form
          surface="controls"
          .selectedFeed=${this.selectedAlgorithm}
          prompt="Want to change something or learn more? Tell us!"
          placeholder="Share your settings feedback or questions"
        ></feedback-form>
      </div>

      ${renderSettingsDetailDialog({
        nodeId: this.selectedNode,
        weights,
        purpose,
        freshness,
        selectedAlgorithm: this.selectedAlgorithm,
        onClose: () => {
          this.selectedNode = null;
        },
      })}
    `;
  }

  #renderCandidateSection(weights: SourceWeights, freshness: number): TemplateResult {
    return html`
      <section class="section section-candidate">
        <h2 class="section-title">Candidate Sources</h2>
        <div class="control-card config-card">
          ${this.#titleButton("time_window", "Time Window")}
          <icon-range-slider
            min="0"
            max="5"
            step="1"
            .value=${freshness}
            .icons=${FRESHNESS_PRESETS.map((preset) => preset.iconSrc)}
            thumbIconSize="24"
            .valueText=${FRESHNESS_PRESETS[freshness]?.label ?? "7d"}
            ariaLabel="Time Window"
            ?disabled=${this.isLoading}
            @slider-preview=${(event: CustomEvent<{ value: number }>) => {
              this.previewFreshness = event.detail.value;
            }}
            @slider-change=${(event: CustomEvent<{ value: number }>) => {
              this.#commitFreshness(event.detail.value);
            }}
          ></icon-range-slider>
        </div>

        ${
          this.selectedAlgorithm === "your-feed"
            ? this.#renderAdjustableSources(weights)
            : html`
                <div class="control-card source-card fixed-source">
                  ${this.#titleButton(
                    this.selectedAlgorithm === "random" ? "random" : "following",
                    this.selectedAlgorithm === "random" ? "Random" : "Following",
                  )}
                </div>
              `
        }
      </section>
    `;
  }

  #renderAdjustableSources(weights: SourceWeights): TemplateResult {
    const masterValue = sourceRankPosition(weights);
    const masterDisabled = this.isLoading || this.lockedSources.length > 0;
    return html`
      <p class="source-controls-help">
        Enter a whole percentage or lock a source to keep it fixed. The Vertical Source Rank Control
        is available when every source is unlocked.
      </p>
      <div class="sources-layout">
        <div class="master-column">
          <span class="master-end-label">Friends</span>
          <icon-range-slider
            orientation="vertical"
            min="0"
            .max=${SOURCE_RANK_MAX}
            step="0.01"
            .value=${masterValue}
            .icons=${LIFECYCLE_ICONS}
            .showValue=${false}
            .valueText=${sourceRankValueText(masterValue)}
            ariaLabel="Source rank"
            ?disabled=${masterDisabled}
            @slider-preview=${(event: CustomEvent<{ value: number }>) => {
              if (masterDisabled) return;
              if (!this.masterStartWeights) this.masterStartWeights = { ...weights };
              const target = blendSourceWeightsToRank(this.masterStartWeights, event.detail.value);
              this.previewSourceWeights = applySourceLocks(
                this.masterStartWeights,
                target,
                this.lockedSources,
              );
            }}
            @slider-change=${(event: CustomEvent<{ value: number }>) => {
              if (masterDisabled) return;
              const start = this.masterStartWeights ?? weights;
              const target = blendSourceWeightsToRank(start, event.detail.value);
              const next = applySourceLocks(start, target, this.lockedSources);
              this.masterStartWeights = null;
              this.#commitSourceWeights(next, "source_mix_master");
            }}
          ></icon-range-slider>
          <span class="master-end-label">All</span>
          ${
            this.lockedSources.length > 0
              ? html`<span class="master-lock-note">Unlock all to adjust</span>`
              : ""
          }
        </div>
        <div class="source-list">
          ${this.#renderSourceControl("following", "following", "Following", weights)}
          ${this.#renderSourceControl(
            "networkLikes",
            "network_likes",
            "Liked by Following",
            weights,
          )}
          ${this.#renderSourceControl(
            "authorsTopics",
            "authors_topics",
            "Liked Authors/Topics",
            weights,
          )}
          ${this.#renderSourceControl("popular", "popular", "Popular", weights)}
        </div>
      </div>
    `;
  }

  #renderSourceControl(
    key: SourceWeightKey,
    nodeId: "following" | "network_likes" | "authors_topics" | "popular",
    label: string,
    weights: SourceWeights,
  ): TemplateResult {
    const bounds = sourceWeightRange(weights, key, this.lockedSources);
    const isLocked = this.lockedSources.includes(key);
    const canLock = isLocked || this.lockedSources.length < 3;
    const canAdjust = bounds.max - bounds.min > 0.0001;
    const isDerived = !isLocked && !canAdjust;
    const adjustmentDisabled = this.isLoading || isLocked || isDerived;
    const sliderMax = isLocked || isDerived ? 1 : bounds.max;
    return html`
      <div class="source-adjustment-row">
        <div class="control-card source-card source-slider-card">
          ${this.#titleButton(nodeId, label)}
          <icon-range-slider
            min="0"
            .max=${sliderMax}
            .scaleMin=${0}
            .scaleMax=${1}
            step="0.01"
            .value=${weights[key]}
            .icons=${LIFECYCLE_ICONS}
            .showValue=${false}
            .valueText=${`${String(Math.round(weights[key] * 100))}%`}
            .ariaLabel=${`${label} amount`}
            ?disabled=${adjustmentDisabled}
            @slider-preview=${(event: CustomEvent<{ value: number }>) => {
              if (adjustmentDisabled) return;
              this.#previewSourceWeight(weights, key, event.detail.value);
            }}
            @slider-change=${(event: CustomEvent<{ value: number }>) => {
              if (adjustmentDisabled) return;
              this.#commitSourceWeight(weights, key, nodeId, event.detail.value);
            }}
          ></icon-range-slider>
        </div>
        <div class="source-editor ${isLocked ? "is-locked" : ""} ${isDerived ? "is-derived" : ""}">
          <label class="percentage-field">
            <span class="sr-only">${label} percentage</span>
            <input
              class="percentage-input"
              type="number"
              inputmode="numeric"
              step="1"
              .min=${String(Math.round(bounds.min * 100))}
              .max=${String(Math.round(bounds.max * 100))}
              .value=${String(Math.round(weights[key] * 100))}
              aria-label=${`${label} percentage`}
              aria-invalid="false"
              required
              ?disabled=${adjustmentDisabled}
              @focus=${(event: FocusEvent) => {
                (event.currentTarget as HTMLInputElement).select();
              }}
              @input=${(event: Event) => {
                const input = event.currentTarget as HTMLInputElement;
                const value = input.valueAsNumber;
                if (this.#validatePercentageInput(input)) {
                  this.#previewSourceWeight(weights, key, value / 100);
                }
              }}
              @change=${(event: Event) => {
                const input = event.currentTarget as HTMLInputElement;
                const value = input.valueAsNumber;
                if (this.#validatePercentageInput(input)) {
                  this.#commitSourceWeight(weights, key, nodeId, value / 100);
                }
              }}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key === "Enter") {
                  (event.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <span class="percentage-suffix" aria-hidden="true">%</span>
          </label>
          <button
            class="source-lock-btn"
            type="button"
            aria-label=${isLocked ? `Unlock ${label} weight` : `Lock ${label} weight`}
            aria-pressed=${isLocked ? "true" : "false"}
            title=${
              canLock
                ? isLocked
                  ? `Unlock ${label}`
                  : `Keep ${label} fixed when other sources change`
                : "At least one source must remain unlocked"
            }
            ?disabled=${!canLock}
            @click=${() => {
              this.#toggleSourceLock(key);
            }}
          >
            <svg viewBox="0 0 640 640" aria-hidden="true">
              <path d=${isLocked ? LOCKED_ICON_PATH : UNLOCKED_ICON_PATH}></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  #renderRankingSection(purpose: number): TemplateResult {
    const engaging = 1 - purpose;
    return html`
      <section class="section section-ranking">
        <h2 class="section-title">Ranking</h2>
        <div class="ranking-grid">
          <div class="control-card signal-card">
            ${this.#titleButton("predict_like", "Engaging")}
            <icon-range-slider
              min="0.2"
              max="0.8"
              step="0.15"
              .value=${engaging}
              .icons=${LIFECYCLE_ICONS}
              .valueText=${engaging.toFixed(2)}
              ariaLabel="Engaging weight"
              ?disabled=${this.isLoading}
              @slider-preview=${(event: CustomEvent<{ value: number }>) => {
                this.previewPurpose = Number((1 - event.detail.value).toFixed(2));
              }}
              @slider-change=${(event: CustomEvent<{ value: number }>) => {
                this.#commitPurpose(Number((1 - event.detail.value).toFixed(2)));
              }}
            ></icon-range-slider>
          </div>
          <div class="control-card signal-card">
            ${this.#titleButton("constructiveness", "Constructive")}
            <icon-range-slider
              min="0.2"
              max="0.8"
              step="0.15"
              .value=${purpose}
              .icons=${LIFECYCLE_ICONS}
              .valueText=${purpose.toFixed(2)}
              ariaLabel="Constructive weight"
              ?disabled=${this.isLoading}
              @slider-preview=${(event: CustomEvent<{ value: number }>) => {
                this.previewPurpose = event.detail.value;
              }}
              @slider-change=${(event: CustomEvent<{ value: number }>) => {
                this.#commitPurpose(event.detail.value);
              }}
            ></icon-range-slider>
          </div>
        </div>
      </section>
    `;
  }

  #renderDiversificationSection(): TemplateResult {
    return html`
      <section class="section section-diversification">
        <h2 class="section-title">Diversification</h2>
        <div class="penalties">
          <button
            class="penalty-pill"
            type="button"
            @click=${() => {
              this.#openNode("repeated_author");
            }}
          >
            <span>Repeated author penalty</span
            ><span class="question-icon" aria-hidden="true">?</span>
          </button>
          <button
            class="penalty-pill"
            type="button"
            @click=${() => {
              this.#openNode("repeated_topic");
            }}
          >
            <span>Repeated topic penalty</span
            ><span class="question-icon" aria-hidden="true">?</span>
          </button>
        </div>
      </section>
    `;
  }

  #renderPolitics(): TemplateResult {
    return html`
      <section class="politics-card">
        <div class="politics-heading">
          ${this.#titleButton("politics", "Politics")}
          <span class="coming-soon">Coming Soon!</span>
        </div>
        <div class="politics-control">
          <icon-range-slider
            min="0.5"
            max="1.5"
            step="0.25"
            value="1"
            .icons=${LIFECYCLE_ICONS}
            valueText="1.00 · Neutral"
            ariaLabel="Politics multiplier, coming soon"
            disabled
          ></icon-range-slider>
        </div>
      </section>
    `;
  }

  #titleButton(nodeId: string, label: string): TemplateResult {
    return html`
      <button
        class="component-title"
        type="button"
        aria-label=${`Learn more about ${label}`}
        @click=${() => {
          this.#openNode(nodeId);
        }}
      >
        <span class="component-title-text">${label}</span>
        <span class="question-icon" aria-hidden="true">?</span>
      </button>
    `;
  }

  #renderArrow(): TemplateResult {
    return html`
      <div class="arrow-connector" aria-hidden="true">
        <svg viewBox="0 0 24 40">
          <line class="arrow-line" x1="12" y1="0" x2="12" y2="32"></line>
          <polygon class="arrow-head" points="6,30 12,40 18,30"></polygon>
        </svg>
      </div>
    `;
  }

  #openNode(nodeId: string): void {
    const node = SETTINGS_NODES[nodeId];
    if (!node) return;
    this.selectedNode = nodeId;
    getRootStore()?.services.analyticsService.capture("howItWorksComponentClicked", {
      component_id: nodeId,
      component_label: node.label,
      component_type: node.type,
      ...feedAnalyticsProperties(this.selectedAlgorithm),
    });
  }

  #isAtDefaults(preferences: {
    sourceWeights: SourceWeights;
    freshness: number;
    purpose: number;
  }): boolean {
    if (preferences.freshness !== DEFAULT_PREFERENCES.freshness) return false;
    if (
      this.selectedAlgorithm !== "random" &&
      preferences.purpose !== DEFAULT_PREFERENCES.purpose
    ) {
      return false;
    }
    if (this.selectedAlgorithm !== "your-feed") return true;
    return (
      preferences.sourceWeights.following === DEFAULT_PREFERENCES.sourceWeights.following &&
      preferences.sourceWeights.networkLikes === DEFAULT_PREFERENCES.sourceWeights.networkLikes &&
      preferences.sourceWeights.authorsTopics === DEFAULT_PREFERENCES.sourceWeights.authorsTopics &&
      preferences.sourceWeights.popular === DEFAULT_PREFERENCES.sourceWeights.popular
    );
  }

  #restoreDefaults(): void {
    const store = getRootStore()?.preferencesStore;
    if (!store || this.isResetting) return;
    const feedName = this.selectedAlgorithm;
    this.previewSourceWeights = null;
    this.previewPurpose = null;
    this.previewFreshness = null;
    this.masterStartWeights = null;
    this.sourceStartWeights = null;
    this.lockedSources = [];
    this.isResetting = true;
    const reset = store.restoreDefaults(feedName);
    if (this.selectedAlgorithm === feedName) {
      this.#showRefreshPopup();
    }
    void reset
      .then((didReset) => {
        if (!didReset && this.selectedAlgorithm === feedName) {
          this.#showRefreshPopup("Couldn't reset settings. Please try again.");
        }
      })
      .finally(() => {
        this.isResetting = false;
      });
  }

  #commitSourceWeights(
    weights: SourceWeights,
    origin: "following" | "network_likes" | "authors_topics" | "popular" | "source_mix_master",
  ): void {
    this.previewSourceWeights = null;
    this.sourceStartWeights = null;
    this.#showRefreshPopup();
    const store = getRootStore()?.preferencesStore;
    if (!store) return;
    void store.save(this.selectedAlgorithm, "source_weights", weights, origin);
  }

  #validatePercentageInput(input: HTMLInputElement): boolean {
    const value = input.valueAsNumber;
    const min = Number(input.min);
    const max = Number(input.max);
    const isValid =
      input.value.trim() !== "" &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max;

    input.setCustomValidity(
      isValid ? "" : `Enter a whole percentage between ${String(min)} and ${String(max)}.`,
    );
    input.setAttribute("aria-invalid", String(!isValid));
    return isValid;
  }

  #previewSourceWeight(weights: SourceWeights, key: SourceWeightKey, value: number): void {
    if (!this.sourceStartWeights) this.sourceStartWeights = { ...weights };
    this.previewSourceWeights = redistributeSourceWeights(
      this.sourceStartWeights,
      key,
      value,
      this.lockedSources,
    );
  }

  #commitSourceWeight(
    weights: SourceWeights,
    key: SourceWeightKey,
    origin: "following" | "network_likes" | "authors_topics" | "popular",
    value: number,
  ): void {
    const start = this.sourceStartWeights ?? weights;
    const next =
      this.previewSourceWeights ?? redistributeSourceWeights(start, key, value, this.lockedSources);
    this.sourceStartWeights = null;
    this.#commitSourceWeights(next, origin);
  }

  #toggleSourceLock(key: SourceWeightKey): void {
    const isLocked = this.lockedSources.includes(key);
    if (!isLocked && this.lockedSources.length >= 3) return;
    this.previewSourceWeights = null;
    this.sourceStartWeights = null;
    this.masterStartWeights = null;
    this.lockedSources = isLocked
      ? this.lockedSources.filter((source) => source !== key)
      : [...this.lockedSources, key];
  }

  #commitFreshness(value: number): void {
    this.previewFreshness = null;
    this.#showRefreshPopup();
    const store = getRootStore()?.preferencesStore;
    if (!store) return;
    void store.save(this.selectedAlgorithm, "freshness", value);
  }

  #commitPurpose(value: number): void {
    this.previewPurpose = null;
    this.#showRefreshPopup();
    const store = getRootStore()?.preferencesStore;
    if (!store) return;
    void store.save(this.selectedAlgorithm, "purpose", value);
  }

  #showRefreshPopup(message = "Refresh your Bluesky feed to see updates!"): void {
    this.refreshPopupMessage = message;
    this.showRefreshPopup = true;
    if (this.refreshPopupTimer) clearTimeout(this.refreshPopupTimer);
    this.refreshPopupTimer = setTimeout(() => {
      this.showRefreshPopup = false;
    }, 3000);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-page": SettingsPage;
  }
}

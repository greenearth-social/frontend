import { html, type TemplateResult } from "lit";
import { MobxLitElement } from "@adobe/lit-mobx";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import type { AlgorithmId } from "../constants/algorithms";
import { ALGORITHMS, feedAnalyticsProperties } from "../constants/algorithms";
import { FRESHNESS_PRESETS } from "../constants/preferences";
import type { FeedPreferences, Preferences, SourceWeights } from "../services/types";
import type { FeedControlName } from "../services/analytics/types";
import { DEFAULT_PREFERENCES } from "../stores/preferences-store";
import type { SourceWeightChangeOrigin } from "../stores/preferences-store";
import type {
  BaselineRefreshOutcome,
  SettingsPreviewStore,
} from "../stores/settings-preview-store";
import type { RootStore } from "../stores/root-store";
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
import "../components/settings-feed-preview";
import type { SettingsFeedPreview } from "../components/settings-feed-preview";
import { GENERATOR_LEGEND } from "../components/generator-presentation";
import { renderSettingsDetailDialog } from "./settings-detail-dialog";
import { settingsPageStyles } from "./settings-page.styles";
import {
  LIFECYCLE_ICONS,
  LOCKED_ICON_PATH,
  SETTINGS_NODES,
  UNLOCKED_ICON_PATH,
} from "./settings-page-config";

function getSettingsPreviewStore(): SettingsPreviewStore | undefined {
  const root = getRootStore() as
    | (Omit<RootStore, "settingsPreviewStore"> & {
        settingsPreviewStore?: SettingsPreviewStore;
      })
    | null;
  return root?.settingsPreviewStore;
}

interface SettingsHistoryEntry {
  id: number;
  before: FeedPreferences;
  after: FeedPreferences;
  mode: "undo" | "redo";
  previewNeededBefore: boolean;
}

function clonePatch(patch: FeedPreferences): FeedPreferences {
  return {
    ...patch,
    ...(patch.sourceWeights ? { sourceWeights: { ...patch.sourceWeights } } : {}),
  };
}

function sourceWeightsEqual(a: SourceWeights, b: SourceWeights): boolean {
  return (
    a.following === b.following &&
    a.networkLikes === b.networkLikes &&
    a.authorsTopics === b.authorsTopics &&
    a.popular === b.popular
  );
}

export const MOBILE_PREVIEW_SETTLE_DELAY_MS = 300;

@customElement("settings-page")
export class SettingsPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @property({ type: String }) selectedAlgorithm: AlgorithmId = "your-feed";
  @state() private isLoading = false;
  @state() private selectedNode: string | null = null;
  @state() private previewSourceWeights: SourceWeights | null = null;
  @state() private previewPurpose: number | null = null;
  @state() private previewFreshness: number | null = null;
  @state() private mobilePreviewOpen = false;
  @state() private isPreviewAnimating = false;
  @state() private showColorLegend = false;
  @state() private isResetting = false;
  @state() private isApplyingHistory = false;
  @state() private previewNeeded = false;
  @state() private historyEntry: SettingsHistoryEntry | null = null;
  @state() private settingsError = "";
  @state() private lockedSources: SourceWeightKey[] = [];
  @state() private baselineRefreshStatus = "";
  private masterStartWeights: SourceWeights | null = null;
  private sourceStartWeights: SourceWeights | null = null;
  private baselineSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private baselineSyncPromise: Promise<void> | null = null;
  private baselineSyncPending = false;
  private baselineRefreshStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private desktopLayoutQuery: MediaQueryList | null = null;
  private changeSequence = 0;
  private settingsRevision = 0;
  private previewAnimationOperation = 0;
  private readonly colorLegendPointerHandler = (event: PointerEvent): void => {
    if (!this.showColorLegend) return;
    const path = event.composedPath();
    const button = this.renderRoot.querySelector("#color-legend-button");
    const legend = this.renderRoot.querySelector("#post-color-legend");
    if ((button && path.includes(button)) || (legend && path.includes(legend))) return;
    this.showColorLegend = false;
  };
  private readonly colorLegendKeyHandler = (event: KeyboardEvent): void => {
    if (!this.showColorLegend || event.key !== "Escape") return;
    event.preventDefault();
    this.#closeColorLegend(true);
  };
  private readonly handleFrontendLeft = (): void => {
    this.#cancelScheduledBaselineSync();
  };
  private readonly requestLifecycleBaselineSync = (): void => {
    if (document.visibilityState === "hidden") return;
    this.#scheduleBaselineSync();
  };
  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.handleFrontendLeft();
      return;
    }
    this.requestLifecycleBaselineSync();
  };
  private readonly handleDesktopLayoutChange = (): void => {
    // Preview is an overlay-only state below the desktop breakpoint. Clear it
    // whenever the layout crosses that boundary so a stale mobile overlay
    // cannot reappear after resizing back down from desktop.
    this.mobilePreviewOpen = false;
    this.showColorLegend = false;
  };

  static styles = settingsPageStyles;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.colorLegendPointerHandler);
    window.addEventListener("keydown", this.colorLegendKeyHandler);
    window.addEventListener("focus", this.requestLifecycleBaselineSync);
    window.addEventListener("pagehide", this.handleFrontendLeft);
    window.addEventListener("pageshow", this.requestLifecycleBaselineSync);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.desktopLayoutQuery = window.matchMedia("(min-width: 1024px)");
    this.desktopLayoutQuery.addEventListener("change", this.handleDesktopLayoutChange);
    const root = getRootStore();
    this.isLoading = Boolean(root && !root.preferencesStore.hasLoaded);
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.colorLegendPointerHandler);
    window.removeEventListener("keydown", this.colorLegendKeyHandler);
    window.removeEventListener("focus", this.requestLifecycleBaselineSync);
    window.removeEventListener("pagehide", this.handleFrontendLeft);
    window.removeEventListener("pageshow", this.requestLifecycleBaselineSync);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.desktopLayoutQuery?.removeEventListener("change", this.handleDesktopLayoutChange);
    this.desktopLayoutQuery = null;
    this.#cancelScheduledBaselineSync();
    if (this.baselineRefreshStatusTimer) clearTimeout(this.baselineRefreshStatusTimer);
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    const root = getRootStore();
    if (!root) {
      this.isLoading = false;
      return;
    }
    if (root.preferencesStore.hasLoaded) {
      this.isLoading = false;
      void this.#activateSelectedFeed(this.selectedAlgorithm);
      return;
    }
    this.isLoading = true;
    void root.preferencesStore.load().finally(() => {
      this.isLoading = false;
      void this.#activateSelectedFeed(this.selectedAlgorithm);
    });
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("selectedAlgorithm")) {
      this.#cancelScheduledBaselineSync();
      this.baselineSyncPending = false;
      this.previewSourceWeights = null;
      this.previewPurpose = null;
      this.previewFreshness = null;
      this.masterStartWeights = null;
      this.sourceStartWeights = null;
      this.lockedSources = [];
      this.selectedNode = null;
      this.mobilePreviewOpen = false;
      this.previewAnimationOperation++;
      this.isPreviewAnimating = false;
      this.showColorLegend = false;
      this.previewNeeded = false;
      this.historyEntry = null;
      this.settingsError = "";
      this.isApplyingHistory = false;
      this.settingsRevision++;
      this.baselineRefreshStatus = "";
      void this.#activateSelectedFeed(this.selectedAlgorithm);
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
    const previewStore = getSettingsPreviewStore();
    const previewBusy = (previewStore?.isGenerating ?? false) || this.isPreviewAnimating;
    const historyAction = this.historyEntry?.mode === "redo" ? "Redo" : "Undo";
    const historyLabel = `${historyAction} last settings change`;
    const settingsTitle = `${ALGORITHMS[this.selectedAlgorithm].label} Settings`;

    return html`
      <div class="settings-layout ${this.mobilePreviewOpen ? "mobile-preview-open" : ""}">
        <div class="controls-column">
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
              <h1 aria-label=${settingsTitle}>
                <span class="page-title-full">${settingsTitle}</span>
                <span class="page-title-short" aria-hidden="true">Settings</span>
              </h1>
              <div class="settings-header-actions">
                <button
                  class="history-btn"
                  type="button"
                  aria-label=${historyLabel}
                  title=${historyLabel}
                  ?disabled=${
                    this.isLoading || this.isApplyingHistory || this.historyEntry === null
                  }
                  @click=${() => {
                    void this.#toggleHistory();
                  }}
                >
                  <wa-icon
                    library="app"
                    name=${this.historyEntry?.mode === "redo" ? "redo" : "undo"}
                  ></wa-icon>
                  <span>${historyAction}</span>
                </button>
                <button
                  class="mobile-preview-btn"
                  type="button"
                  ?disabled=${!this.previewNeeded || previewBusy}
                  @click=${() => {
                    void this.#previewChanges();
                  }}
                >
                  Preview
                </button>
              </div>
                <button
                  class="reset-defaults-btn"
                  type="button"
                  aria-label="Reset settings to defaults"
                  ?disabled=${this.isLoading || this.isResetting || isAtDefaults}
                  @click=${() => {
                    void this.#restoreDefaults();
                  }}
                >
                  <svg viewBox="0 0 640 640" aria-hidden="true">
                    <path
                      d="M320 128C426 128 512 214 512 320C512 426 426 512 320 512C254.8 512 197.1 479.5 162.4 429.7C152.3 415.2 132.3 411.7 117.8 421.8C103.3 431.9 99.8 451.9 109.9 466.4C156.1 532.6 233 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C234.3 64 158.5 106.1 112 170.7L112 144C112 126.3 97.7 112 80 112C62.3 112 48 126.3 48 144L48 256C48 273.7 62.3 288 80 288L104.6 288C105.1 288 105.6 288 106.1 288L192.1 288C209.8 288 224.1 273.7 224.1 256C224.1 238.3 209.8 224 192.1 224L153.8 224C186.9 166.6 249 128 320 128zM344 216C344 202.7 333.3 192 320 192C306.7 192 296 202.7 296 216L296 320C296 326.4 298.5 332.5 303 337L375 409C384.4 418.4 399.6 418.4 408.9 409C418.2 399.6 418.3 384.4 408.9 375.1L343.9 310.1L343.9 216z"
                    ></path>
                  </svg>
                  <span class="reset-label">Defaults</span>
                </button>
            </div>
          </div>

          <div class="page-content">
            ${
              previewStore?.warning
                ? html`<p class="controls-preview-warning" role="status">
                    ${previewStore.warning}
                  </p>`
                : ""
            }
            ${
              this.settingsError
                ? html`<p class="controls-preview-warning settings-error" role="alert">
                    ${this.settingsError}
                  </p>`
                : ""
            }
            ${
              this.isLoading
                ? html`<div class="saved-settings-loading" role="status" aria-live="polite">
                    Loading your saved settings…
                  </div>`
                : html`
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

                    <feedback-form
                      surface="controls"
                      .selectedFeed=${this.selectedAlgorithm}
                      prompt="Want to change something or learn more? Tell us!"
                      placeholder="Share your settings feedback or questions"
                    ></feedback-form>
                  `
            }
          </div>
        </div>

        <aside class="feed-column" aria-label="Feed preview">
          <div class="preview-header">
            <button
              id="update-preview"
              class="update-preview-btn"
              type="button"
              ?disabled=${!this.previewNeeded || previewBusy}
              @click=${() => {
                void this.#previewChanges();
              }}
            >
              Update Preview
            </button>
            <div class="preview-mobile-primary-actions">
              <button
                class="preview-close"
                type="button"
                aria-label="Back to settings"
                title="Back to settings"
                ?disabled=${previewBusy}
                @click=${() => {
                  this.#closeMobilePreview();
                }}
              >
                <wa-icon library="app" name="chevron-left"></wa-icon>
              </button>
              <h2 class="mobile-preview-title">Preview</h2>
            </div>
            <div class="preview-header-actions">
              <button
                id="color-legend-button"
                class="palette-button"
                type="button"
                aria-label="Show post color legend"
                aria-controls="post-color-legend"
                aria-expanded=${String(this.showColorLegend)}
                title="Post color legend"
                @click=${() => {
                  this.showColorLegend = !this.showColorLegend;
                }}
              >
                <wa-icon library="app" name="palette"></wa-icon>
              </button>
            </div>
            ${
              this.showColorLegend
                ? html`<div
                    id="post-color-legend"
                    class="color-legend"
                    role="region"
                    aria-label="Post color legend"
                  >
                    <strong>Post colors</strong>
                    <div class="color-legend-list" role="list">
                      ${GENERATOR_LEGEND.map(
                        (entry) =>
                          html`<div class="color-legend-row" role="listitem">
                            <span
                              class="color-legend-swatch"
                              style="--legend-border:${entry.border};--legend-background:${entry.background}"
                              aria-hidden="true"
                            ></span>
                            <span>${entry.label}</span>
                          </div>`,
                      )}
                    </div>
                  </div>`
                : ""
            }
          </div>
          ${previewStore?.warning ? html`<p class="preview-warning">${previewStore.warning}</p>` : ""}
          ${
            this.baselineRefreshStatus
              ? html`<p class="preview-sync-status" role="status" aria-live="polite">
                  ${this.baselineRefreshStatus}
                </p>`
              : ""
          }
          ${
            previewStore?.baselineRefreshError
              ? html`<div class="preview-error baseline-refresh-error" role="status">
                  <span>Current feed could not be refreshed. We’ll check again when you return.</span>
                </div>`
              : ""
          }
          <div class="feed-scroll">
            <settings-feed-preview
              .items=${previewStore?.displayedItems ?? []}
              .loading=${
                (previewStore?.isLoadingBaseline ?? false) || (previewStore?.isGenerating ?? false)
              }
              .error=${previewStore?.error ?? ""}
              .filteringCounts=${previewStore?.displayedFilteringCounts ?? null}
            ></settings-feed-preview>
          </div>
          ${
            previewStore?.isGenerating
              ? html`<div class="preview-generating" role="status">Generating preview…</div>`
              : ""
          }
          ${
            previewStore?.error && previewStore.displayedItems.length > 0
              ? html` <div class="preview-error" role="alert">
                  <span>${previewStore.error}</span>
                  <button
                    type="button"
                    @click=${() => {
                      void this.#previewChanges();
                    }}
                  >
                    Retry
                  </button>
                </div>`
              : ""
          }
        </aside>
      </div>

      ${
        this.isLoading
          ? ""
          : renderSettingsDetailDialog({
              nodeId: this.selectedNode,
              weights,
              purpose,
              freshness,
              selectedAlgorithm: this.selectedAlgorithm,
              onClose: () => {
                this.selectedNode = null;
              },
            })
      }
    `;
  }

  #renderCandidateSection(weights: SourceWeights, freshness: number): TemplateResult {
    return html`
      <section class="section section-candidate">
        <h2 class="section-title">Sources</h2>
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
                  event.preventDefault();
                  const input = event.currentTarget as HTMLInputElement;
                  const value = input.valueAsNumber;
                  if (this.#validatePercentageInput(input)) {
                    this.#commitSourceWeight(weights, key, nodeId, value / 100);
                  }
                  input.blur();
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
          ${this.#renderPolitics()}
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
      <div class="politics-card">
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
      </div>
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

  async #restoreDefaults(): Promise<void> {
    if (this.isResetting) return;
    const root = getRootStore();
    if (!root) return;
    const before = this.#settingsPatch(root.preferencesStore.valuesFor(this.selectedAlgorithm));
    const after = this.#settingsPatch(DEFAULT_PREFERENCES);
    if (JSON.stringify(before) === JSON.stringify(after)) return;

    this.previewSourceWeights = null;
    this.previewPurpose = null;
    this.previewFreshness = null;
    this.masterStartWeights = null;
    this.sourceStartWeights = null;
    this.lockedSources = [];
    this.isResetting = true;
    await this.#applyImmediateChange(before, after, {
      ...(after.sourceWeights ? { source_weights: "reset_defaults" as const } : {}),
    });
    this.isResetting = false;
  }

  #commitSourceWeights(
    weights: SourceWeights,
    origin: "following" | "network_likes" | "authors_topics" | "popular" | "source_mix_master",
  ): void {
    this.previewSourceWeights = null;
    this.sourceStartWeights = null;
    const current = getRootStore()?.preferencesStore.valuesFor(
      this.selectedAlgorithm,
    ).sourceWeights;
    if (!current || sourceWeightsEqual(current, weights)) return;
    void this.#applyImmediateChange(
      { sourceWeights: { ...current } },
      { sourceWeights: { ...weights } },
      { source_weights: origin },
    );
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
    const current = getRootStore()?.preferencesStore.valuesFor(this.selectedAlgorithm).freshness;
    if (current === undefined || current === value) return;
    void this.#applyImmediateChange({ freshness: current }, { freshness: value });
  }

  #commitPurpose(value: number): void {
    this.previewPurpose = null;
    const current = getRootStore()?.preferencesStore.valuesFor(this.selectedAlgorithm).purpose;
    if (current === undefined || current === value) return;
    void this.#applyImmediateChange({ purpose: current }, { purpose: value });
  }

  #settingsPatch(values: Preferences): FeedPreferences {
    const patch: FeedPreferences = { freshness: values.freshness };
    if (this.selectedAlgorithm !== "random") patch.purpose = values.purpose;
    if (this.selectedAlgorithm === "your-feed") {
      patch.sourceWeights = { ...values.sourceWeights };
    }
    return patch;
  }

  async #applyImmediateChange(
    before: FeedPreferences,
    after: FeedPreferences,
    origins: Partial<Record<FeedControlName, SourceWeightChangeOrigin>> = {},
  ): Promise<boolean> {
    const root = getRootStore();
    if (!root || JSON.stringify(before) === JSON.stringify(after)) return false;
    const previousHistory = this.historyEntry;
    const entry: SettingsHistoryEntry = {
      id: ++this.changeSequence,
      before: clonePatch(before),
      after: clonePatch(after),
      mode: "undo",
      previewNeededBefore: this.previewNeeded,
    };
    this.historyEntry = entry;
    this.previewNeeded = true;
    this.showColorLegend = false;
    this.settingsError = "";
    this.settingsRevision++;

    const succeeded = await root.preferencesStore.savePatch(
      this.selectedAlgorithm,
      clonePatch(after),
      origins,
    );
    const currentHistory = this.#currentHistoryEntry();
    if (!succeeded && currentHistory?.id === entry.id && currentHistory.mode === "undo") {
      this.historyEntry = previousHistory;
      this.previewNeeded = entry.previewNeededBefore;
      this.settingsError = "Settings could not be updated. Please try again.";
    }
    return succeeded;
  }

  async #toggleHistory(): Promise<void> {
    const root = getRootStore();
    const entry = this.historyEntry;
    if (!root || !entry || this.isApplyingHistory) return;
    const previousMode = entry.mode;
    const nextMode = previousMode === "undo" ? "redo" : "undo";
    const patch = previousMode === "undo" ? entry.before : entry.after;
    const previewNeededBefore = this.previewNeeded;
    this.historyEntry = { ...entry, mode: nextMode };
    this.previewNeeded = true;
    this.settingsError = "";
    this.settingsRevision++;
    this.isApplyingHistory = true;
    const origins: Partial<Record<FeedControlName, SourceWeightChangeOrigin>> = patch.sourceWeights
      ? { source_weights: previousMode }
      : {};
    const succeeded = await root.preferencesStore.savePatch(
      this.selectedAlgorithm,
      clonePatch(patch),
      origins,
    );
    const currentHistory = this.#currentHistoryEntry();
    if (!succeeded && currentHistory?.id === entry.id && currentHistory.mode === nextMode) {
      this.historyEntry = entry;
      this.previewNeeded = previewNeededBefore;
      this.settingsError = `${previousMode === "undo" ? "Undo" : "Redo"} could not be applied. Please try again.`;
    }
    this.isApplyingHistory = false;
  }

  #currentHistoryEntry(): SettingsHistoryEntry | null {
    return this.historyEntry;
  }

  async #previewChanges(): Promise<void> {
    const store = getSettingsPreviewStore();
    const root = getRootStore();
    if (!store || !root || !this.previewNeeded || store.isGenerating || this.isPreviewAnimating) {
      return;
    }
    if (store.isRefreshingBaseline) this.baselineSyncPending = true;
    const isMobilePreview = window.matchMedia("(max-width: 1023px)").matches;
    if (isMobilePreview) this.mobilePreviewOpen = true;
    const feedName = this.selectedAlgorithm;
    const revision = this.settingsRevision;
    const animationOperation = ++this.previewAnimationOperation;
    const patch = this.#settingsPatch(root.preferencesStore.valuesFor(this.selectedAlgorithm));
    const generated = await store.preview(patch);
    if (
      !generated ||
      revision !== this.settingsRevision ||
      feedName !== this.selectedAlgorithm ||
      animationOperation !== this.previewAnimationOperation
    ) {
      this.#drainBaselineSyncQueue();
      return;
    }
    const feed = this.renderRoot.querySelector<SettingsFeedPreview>("settings-feed-preview");
    this.isPreviewAnimating = true;
    try {
      if (isMobilePreview) {
        // Let the overlay settle briefly before its contents begin moving so
        // the transition to the Preview screen remains easy to follow.
        await this.updateComplete;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, MOBILE_PREVIEW_SETTLE_DELAY_MS);
        });
        if (
          revision !== this.settingsRevision ||
          feedName !== this.selectedAlgorithm ||
          animationOperation !== this.previewAnimationOperation
        ) {
          return;
        }
      }
      if (feed) await feed.animateTo(generated.items);
      if (
        revision !== this.settingsRevision ||
        feedName !== this.selectedAlgorithm ||
        animationOperation !== this.previewAnimationOperation
      ) {
        return;
      }
      store.acceptPreview(generated);
      this.previewNeeded = false;
    } finally {
      if (animationOperation === this.previewAnimationOperation) {
        this.isPreviewAnimating = false;
      }
      this.#drainBaselineSyncQueue();
    }
  }

  async #refreshCurrentFeed(): Promise<BaselineRefreshOutcome> {
    const store = getSettingsPreviewStore();
    if (!store) {
      return { status: "deferred" };
    }

    const feedName = this.selectedAlgorithm;
    const outcome = await store.refreshBaselineIfNew(feedName);
    if (!this.isConnected || feedName !== this.selectedAlgorithm) return outcome;

    if (outcome.status === "updated") {
      this.showColorLegend = false;
      await this.updateComplete;
      this.renderRoot
        .querySelector<SettingsFeedPreview>("settings-feed-preview")
        ?.settleAsOrigin(store.baselineItems);
      this.#showBaselineRefreshStatus("Current feed updated from Bluesky");
    }
    return outcome;
  }

  async #activateSelectedFeed(feedName: AlgorithmId): Promise<void> {
    const store = getSettingsPreviewStore();
    if (!store) return;
    await store.activateFeed(feedName);
    if (!this.isConnected || this.selectedAlgorithm !== feedName) return;
    this.#drainBaselineSyncQueue();
  }

  #scheduleBaselineSync(): void {
    if (this.baselineSyncTimer || !this.isConnected || document.visibilityState === "hidden") {
      return;
    }
    this.baselineSyncTimer = setTimeout(() => {
      this.baselineSyncTimer = null;
      void this.#requestBaselineSync();
    }, 0);
  }

  async #requestBaselineSync(): Promise<void> {
    if (!this.isConnected || document.visibilityState === "hidden") return;
    const store = getSettingsPreviewStore();
    if (!store) return;
    if (store.isLoadingBaseline || store.isGenerating || this.isPreviewAnimating) {
      this.baselineSyncPending = true;
      return;
    }
    if (this.baselineSyncPromise) {
      this.baselineSyncPending = true;
      await this.baselineSyncPromise;
      return;
    }

    this.baselineSyncPending = false;
    const sync = this.#refreshCurrentFeed().then(() => undefined);
    this.baselineSyncPromise = sync;
    try {
      await sync;
    } finally {
      if (this.baselineSyncPromise === sync) this.baselineSyncPromise = null;
      this.#drainBaselineSyncQueue();
    }
  }

  #drainBaselineSyncQueue(): void {
    if (!this.baselineSyncPending) return;
    const store = getSettingsPreviewStore();
    if (
      !store ||
      store.isLoadingBaseline ||
      store.isGenerating ||
      this.isPreviewAnimating ||
      this.baselineSyncPromise
    ) {
      return;
    }
    this.baselineSyncPending = false;
    this.#scheduleBaselineSync();
  }

  #cancelScheduledBaselineSync(): void {
    if (this.baselineSyncTimer) clearTimeout(this.baselineSyncTimer);
    this.baselineSyncTimer = null;
  }

  #showBaselineRefreshStatus(message: string): void {
    this.baselineRefreshStatus = message;
    if (this.baselineRefreshStatusTimer) clearTimeout(this.baselineRefreshStatusTimer);
    this.baselineRefreshStatusTimer = setTimeout(() => {
      this.baselineRefreshStatus = "";
      this.baselineRefreshStatusTimer = null;
    }, 4_000);
  }

  #closeMobilePreview(): void {
    const store = getSettingsPreviewStore();
    if (store?.isGenerating || this.isPreviewAnimating) return;
    this.mobilePreviewOpen = false;
    this.showColorLegend = false;
  }

  #focusAfterUpdate(selector: string): void {
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  #closeColorLegend(returnFocus: boolean): void {
    this.showColorLegend = false;
    if (returnFocus) this.#focusAfterUpdate("#color-legend-button");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-page": SettingsPage;
  }
}

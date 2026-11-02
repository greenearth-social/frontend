import { html, type TemplateResult } from "lit";
import { MobxLitElement } from "@adobe/lit-mobx";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import { LIFECYCLE_ICONS, MAX_PROMPT_CHARS } from "../pages/settings-page-config";
import "./icon-range-slider";

// The Filter card (api#566): a second fitted prompt and a slider that scales
// the rank score of every post of that kind. Renders into the page's DOM so
// its styles apply; state lives in the root's llmFilterStore. It never saves
// preferences: it emits filter-preview / filter-change / filter-help /
// filter-prompt-changed and the page acts, so undo and redo keep working.

// Saved value is the multiplier; slider position is the index.
export const LLM_FILTER_STOPS = [0.5, 0.75, 1, 1.5, 2];

const LLM_FILTER_LABELS: Record<number, string> = {
  0.5: "0.5 · Min",
  0.75: "0.75 · Less",
  1: "1.0 · Default",
  1.5: "1.5 · More",
  2: "2.0 · Max",
};

export function formatLlmFilter(value: number): string {
  return LLM_FILTER_LABELS[value] ?? value.toFixed(2);
}

export function llmFilterStopIndex(value: number): number {
  return LLM_FILTER_STOPS.reduce(
    (nearest, stop, index) =>
      Math.abs(stop - value) < Math.abs((LLM_FILTER_STOPS[nearest] ?? value) - value)
        ? index
        : nearest,
    0,
  );
}

@customElement("llm-filter-card")
export class LlmFilterCard extends MobxLitElement {
  @property({ type: Number }) setting = 0.5;
  @property({ type: Boolean }) disabled = false;
  @state() private draft = "";

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  #emit(name: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  async #send(draft: string): Promise<void> {
    const store = getRootStore()?.llmFilterStore;
    const text = draft.trim();
    if (!store || !text || store.isFitting || store.isRemoving) return;
    try {
      await store.fit(text);
      if (this.draft === draft) this.draft = "";
      this.#emit("filter-prompt-changed");
    } catch {
      // The store keeps the failure; it shows below the editor.
    }
  }

  async #remove(promptKey: string): Promise<void> {
    const store = getRootStore()?.llmFilterStore;
    if (store && (await store.remove(promptKey))) this.#emit("filter-prompt-changed");
  }

  render(): TemplateResult {
    const store = getRootStore()?.llmFilterStore;
    const fitted = store?.prompt ?? null;
    const isFitting = store?.isFitting ?? false;
    const isRemoving = store?.isRemoving ?? false;
    const failure = store?.failure ?? null;
    const draft = this.draft;
    const inactive = fitted === null;
    const sliderDisabled = this.disabled || inactive;
    const canSend = !this.disabled && !isFitting && draft.trim().length > 0;
    return html`
      <div
        class="control-card source-card filter-card ${inactive ? "inactive" : ""} ${isFitting ? "thinking" : ""}"
        aria-busy=${isFitting ? "true" : "false"}
      >
        <button
          class="component-title"
          type="button"
          aria-label="Learn more about Filter"
          @click=${() => {
            this.#emit("filter-help");
          }}
        >
          <span class="component-title-text">Filter</span>
          <span class="question-icon" aria-hidden="true">?</span>
        </button>
        <div class="prompt-editor filter-prompt-editor">
          ${
            fitted
              ? html`
                  <div class="active-prompt">
                    <div class="active-prompt-content expanded">
                      <button
                        class="prompt-remove-btn"
                        type="button"
                        aria-label="Remove active filter prompt"
                        ?disabled=${isRemoving || isFitting}
                        @click=${() => {
                          void this.#remove(fitted.promptKey);
                        }}
                      >
                        <span class="prompt-remove-label"
                          >${isRemoving ? "Removing…" : "Remove"}</span
                        >
                      </button>
                      <span class="active-prompt-label">Filtering</span>
                      <p
                        class="active-prompt-text"
                        .textContent=${fitted.subject ?? fitted.prompt}
                      ></p>
                    </div>
                  </div>
                `
              : ""
          }
          <div class="prompt-composer">
            <textarea
              class="prompt-input filter-prompt-input"
              rows="1"
              placeholder="Describe the posts, e.g. airplanes"
              aria-label="Filter prompt"
              maxlength=${MAX_PROMPT_CHARS}
              .value=${draft}
              ?disabled=${isFitting}
              @input=${(event: Event) => {
                this.draft = (event.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
            <div class="prompt-footer">
              <span class="prompt-count">${draft.length} / ${MAX_PROMPT_CHARS}</span>
              <button
                class="prompt-send-btn filter-prompt-send-btn"
                type="button"
                ?disabled=${!canSend}
                @click=${() => {
                  void this.#send(draft);
                }}
              >
                <span class="prompt-send-label">${isFitting ? "Thinking…" : "Send"}</span>
              </button>
            </div>
          </div>
          ${failure ? html`<p class="filter-error" role="alert">${failure.message}</p>` : ""}
        </div>
        <div class="filter-slider">
          <icon-range-slider
            min="0"
            .max=${LLM_FILTER_STOPS.length - 1}
            step="1"
            .value=${llmFilterStopIndex(this.setting)}
            .icons=${LIFECYCLE_ICONS}
            .valueText=${formatLlmFilter(this.setting)}
            ariaLabel="Filter multiplier"
            ?disabled=${sliderDisabled}
            @slider-preview=${(event: CustomEvent<{ value: number }>) => {
              if (sliderDisabled) return;
              this.#emit("filter-preview", { value: LLM_FILTER_STOPS[event.detail.value] });
            }}
            @slider-change=${(event: CustomEvent<{ value: number }>) => {
              if (sliderDisabled) return;
              this.#emit("filter-change", { value: LLM_FILTER_STOPS[event.detail.value] });
            }}
          ></icon-range-slider>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "llm-filter-card": LlmFilterCard;
  }
}

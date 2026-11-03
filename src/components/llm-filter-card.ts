import { html, type TemplateResult } from "lit";
import { MobxLitElement } from "@adobe/lit-mobx";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import { MAX_PROMPT_CHARS } from "../pages/settings-page-config";
import { renderToggleSwitch } from "./toggle-switch";

// The second fitted prompt (api#566, "filter" in the api): "Most posts I see
// should: ...". While it is on, the ranking moves the posts it describes up.
// Renders into the page's DOM so its styles apply; state lives in the root's
// llmFilterStore. It never saves preferences: it emits filter-change and
// filter-prompt-changed ({ fitted }) and the page acts, so undo and redo keep
// working; after a fit the page switches the filter on.

export const LLM_FILTER_TITLE = "Most posts I see should:";
export const LLM_FILTER_PLACEHOLDER =
  "(e.g.) be generally uplifting and funny. And not discuss airplanes or cars.";

@customElement("llm-filter-card")
export class LlmFilterCard extends MobxLitElement {
  @property({ type: Boolean }) enabled = true;
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
      this.#emit("filter-prompt-changed", { fitted: true });
    } catch {
      // The store keeps the failure; it shows below the editor.
    }
  }

  async #remove(promptKey: string): Promise<void> {
    const store = getRootStore()?.llmFilterStore;
    if (store && (await store.remove(promptKey))) {
      this.#emit("filter-prompt-changed", { fitted: false });
    }
  }

  render(): TemplateResult {
    const store = getRootStore()?.llmFilterStore;
    const fitted = store?.prompt ?? null;
    const isFitting = store?.isFitting ?? false;
    const isRemoving = store?.isRemoving ?? false;
    const failure = store?.failure ?? null;
    const draft = this.draft;
    const inactive = fitted === null;
    const toggleDisabled = this.disabled || inactive;
    const canSend = !this.disabled && !isFitting && draft.trim().length > 0;
    return html`
      <div
        class="control-card source-card filter-card ${inactive ? "inactive" : ""} ${isFitting ? "thinking" : ""}"
        aria-busy=${isFitting ? "true" : "false"}
      >
        <div class="component-title component-title-static">
          <span class="component-title-text">${LLM_FILTER_TITLE}</span>
        </div>
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
                        title="Remove"
                        ?disabled=${isRemoving || isFitting}
                        @click=${() => {
                          void this.#remove(fitted.promptKey);
                        }}
                      >
                        <span aria-hidden="true">${isRemoving ? "…" : "×"}</span>
                      </button>
                      <span class="active-prompt-label">Active prompt</span>
                      <p class="active-prompt-text" .textContent=${fitted.prompt}></p>
                    </div>
                  </div>
                `
              : ""
          }
          <div class="prompt-composer">
            <textarea
              class="prompt-input filter-prompt-input"
              rows="2"
              placeholder=${LLM_FILTER_PLACEHOLDER}
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
                aria-label="Send filter prompt"
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
        <div class="filter-toggle">
          ${renderToggleSwitch({
            inputClass: "filter-toggle-input",
            ariaLabel: "Filter active",
            checked: this.enabled,
            disabled: toggleDisabled,
            text: this.enabled ? "Filter is active" : "Filter is inactive",
            onChange: (enabled) => {
              this.#emit("filter-change", { enabled });
            },
          })}
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

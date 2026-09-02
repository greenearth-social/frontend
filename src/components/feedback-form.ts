import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedbackSurface } from "../config/runtime-config";
import { ALGORITHMS, type AlgorithmId } from "../constants/algorithms";
import type { FeedbackEventPayload } from "../services/feedback/types";
import { getRootStore } from "../main";

@customElement("feedback-form")
export class FeedbackForm extends LitElement {
  @property({ type: String }) surface: FeedbackSurface = "general";
  @property({ type: String }) selectedFeed: AlgorithmId = "your-feed";
  @property({ type: String }) prompt = "";
  @property({ type: String }) placeholder = "Share your feedback";

  @state() private response = "";
  @state() private isSubmitting = false;
  @state() private message = "";
  @state() private messageKind: "success" | "test" | "error" | "" = "";
  @state() private previewPayload: FeedbackEventPayload | null = null;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    .feedback-card {
      padding: 1rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 1rem;
      background: var(--bluesky-bg-card);
    }
    label {
      display: block;
      margin-bottom: 0.75rem;
      color: var(--bluesky-text);
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.4;
    }
    .feed-context {
      display: inline-flex;
      margin-bottom: 0.625rem;
      padding: 0.25rem 0.625rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
    }
    textarea {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: 7rem;
      resize: vertical;
      padding: 0.75rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.75rem;
      outline: none;
      background: var(--bluesky-bg);
      color: var(--bluesky-text);
      font: inherit;
      line-height: 1.5;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    textarea::placeholder {
      color: var(--bluesky-text-secondary);
    }
    textarea:focus {
      border-color: var(--bluesky-brand);
      box-shadow: 0 0 0 2px rgba(16, 131, 254, 0.2);
    }
    .form-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 0.75rem;
    }
    .character-count {
      color: var(--bluesky-text-secondary);
      font-size: 0.75rem;
    }
    button {
      min-width: 6rem;
      padding: 0.625rem 1rem;
      border: 0;
      border-radius: 9999px;
      background: var(--bluesky-brand);
      color: white;
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      transition:
        background 0.15s,
        opacity 0.15s;
    }
    button:hover:not(:disabled),
    button:focus-visible:not(:disabled) {
      background: var(--bluesky-brand-hover);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .status {
      margin: 0.75rem 0 0;
      font-size: 0.875rem;
      line-height: 1.4;
    }
    .status.success {
      color: var(--bluesky-repost);
    }
    .status.test {
      color: #f2c94c;
    }
    .status.error {
      color: var(--bluesky-danger);
    }
    details {
      margin-top: 0.75rem;
      border-top: 1px solid var(--bluesky-border);
      padding-top: 0.75rem;
    }
    summary {
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    pre {
      max-height: 20rem;
      overflow: auto;
      margin: 0.75rem 0 0;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: var(--bluesky-bg);
      color: var(--bluesky-text-secondary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.6875rem;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;

  render() {
    const store = getRootStore();
    const unavailableReason =
      store?.feedbackStore.unavailableReasonFor(this.surface) ?? null;
    const unavailable = unavailableReason !== null;

    return html`
      <form class="feedback-card" @submit=${this.#handleSubmit}>
        <div class="feed-context">${ALGORITHMS[this.selectedFeed].label}</div>
        <label for="feedback-input">${this.prompt}</label>
        <textarea
          id="feedback-input"
          name="feedback"
          .value=${this.response}
          placeholder=${this.placeholder}
          maxlength="2000"
          required
          ?disabled=${this.isSubmitting || unavailable}
          @input=${this.#handleInput}
        ></textarea>
        <div class="form-footer">
          <span class="character-count">${this.response.length}/2000</span>
          <button
            type="submit"
            ?disabled=${this.isSubmitting || unavailable || !this.response.trim()}
          >
            ${this.isSubmitting ? "Sending…" : "Submit"}
          </button>
        </div>
        ${unavailable
          ? html`<p class="status error" role="status">${unavailableReason}</p>`
          : this.message
            ? html`<p
                class="status ${this.messageKind}"
                role=${this.messageKind === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                ${this.message}
              </p>`
            : ""}
        ${this.previewPayload
          ? html`
              <details>
                <summary>Preview PostHog payload</summary>
                <pre>${JSON.stringify(this.previewPayload, null, 2)}</pre>
              </details>
            `
          : ""}
      </form>
    `;
  }

  #handleInput = (event: Event) => {
    this.response = (event.target as HTMLTextAreaElement).value;
    if (this.messageKind === "error") {
      this.message = "";
      this.messageKind = "";
    }
  };

  #handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    const response = this.response.trim();
    const store = getRootStore();
    if (!response || !store) return;

    this.isSubmitting = true;
    this.message = "";
    this.messageKind = "";
    try {
      const result = await store.feedbackStore.submit(
        this.surface,
        response,
        this.selectedFeed,
      );
      this.previewPayload = result.sent ? null : result.payload;
      this.response = "";
      this.message = result.sent
        ? "Thanks for your feedback!"
        : "Test mode: this feedback was not sent to PostHog.";
      this.messageKind = result.sent ? "success" : "test";
    } catch (error) {
      this.message =
        error instanceof Error
          ? error.message
          : "We couldn't send your feedback. Please try again.";
      this.messageKind = "error";
    } finally {
      this.isSubmitting = false;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "feedback-form": FeedbackForm;
  }
}

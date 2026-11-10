import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { reportClientError } from "../services/telemetry/telemetry-service";

@customElement("error-boundary")
export class ErrorBoundary extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
    }
    .error-container {
      padding: 2rem 1.5rem;
      margin: 1.5rem;
      border: 1px solid var(--bluesky-border, #2f3336);
      border-radius: 0.75rem;
      background: var(--bluesky-nav-bg, #16181c);
      text-align: center;
      color: var(--bluesky-text, #fff);
    }
    .error-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .error-message {
      font-size: 0.875rem;
      color: var(--bluesky-text-secondary, #71767b);
      margin-bottom: 1.25rem;
      max-width: 480px;
      margin-inline: auto;
    }
    .retry-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      border: none;
      background: var(--bluesky-brand, #0085ff);
      color: #fff;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .retry-button:hover {
      opacity: 0.9;
    }
  `;

  @property({ type: String }) boundaryName = "GlobalErrorBoundary";
  @state() hasError = false;
  @state() errorMessage = "";

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("error", this.#handleChildError as EventListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("error", this.#handleChildError as EventListener);
  }

  #handleChildError = (event: ErrorEvent): void => {
    event.stopPropagation();
    this.catchError(event.error ?? new Error(event.message));
  };

  catchError(error: unknown): void {
    this.hasError = true;
    const msg = error instanceof Error ? error.message : String(error);
    this.errorMessage = msg;
    reportClientError(`${this.boundaryName}:RenderError`, {
      message: msg,
      stack: error instanceof Error ? error.stack : undefined,
    });
    this.requestUpdate();
  }

  reset(): void {
    this.hasError = false;
    this.errorMessage = "";
    this.requestUpdate();
  }

  override render() {
    if (this.hasError) {
      return html`
        <div class="error-container" role="alert">
          <div class="error-title">Something went wrong</div>
          <div class="error-message">
            ${this.errorMessage || "An unexpected error occurred while displaying this content."}
          </div>
          <button class="retry-button" type="button" @click=${() => { this.reset(); }}>
            Try again
          </button>
        </div>
      `;
    }
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "error-boundary": ErrorBoundary;
  }
}

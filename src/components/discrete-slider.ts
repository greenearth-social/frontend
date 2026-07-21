import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("discrete-slider")
export class DiscreteSlider extends LitElement {
  @property({ type: Array }) options: string[] = [];
  @property({ type: Number }) value = 0;
  @property({ type: Boolean }) disabled = false;

  static styles = css`
    :host {
      display: block;
    }
    .slider-container {
      position: relative;
      margin-bottom: 1.5rem;
    }
    .slider-container.disabled {
      opacity: 0.4;
    }
    .labels-track {
      display: flex;
      justify-content: space-between;
      padding: 0 0.75rem;
      margin-bottom: 0.25rem;
    }
    .label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--bluesky-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: center;
      flex: 1;
    }
    .slider-wrapper {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      padding: 0.375rem 0.75rem;
      position: relative;
      overflow: hidden;
    }
    .slider-track {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      height: 40px;
    }
    .thumb {
      position: absolute;
      top: 50%;
      left: 0;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
      box-shadow: 0 2px 8px rgba(16, 131, 254, 0.4);
      pointer-events: none;
      z-index: 1;
      transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .step-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      height: 40px;
      position: relative;
      z-index: 2;
    }
    .step-icon {
      width: 18px;
      height: 18px;
      fill: var(--bluesky-text-secondary);
      opacity: 0.45;
      transition: all 0.15s ease;
      pointer-events: none;
    }
    .step-btn:hover .step-icon {
      fill: #91bd3f;
      opacity: 0.85;
    }
    .step-btn.active .step-icon {
      width: 22px;
      height: 22px;
      fill: #b4dc54;
      opacity: 1;
    }
    .step-btn:disabled {
      cursor: default;
    }
  `;

  private _handleClick(index: number) {
    if (this.disabled) return;
    this.value = index;
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: index },
      })
    );
  }

  private _getThumbPercent(): number {
    const n = this.options.length;
    if (n === 0) return 0;
    return ((this.value + 0.5) / n) * 100;
  }

  render() {
    return html`
      <div class="slider-container ${this.disabled ? "disabled" : ""}">
        <div class="labels-track">
          ${this.options.map(
            (option) => html`<span class="label">${option}</span>`
          )}
        </div>
        <div class="slider-wrapper">
          <div class="slider-track">
            <div class="thumb" style="left: ${this._getThumbPercent()}%"></div>
            ${this.options.map(
              (_, index) => html`
                <button
                  class="step-btn ${index === this.value ? "active" : ""}"
                  type="button"
                  ?disabled=${this.disabled}
                  @click=${() => { this._handleClick(index); }}
                >
                  <svg
                    class="step-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 640 640"
                    aria-hidden="true"
                  >
                    <path d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"></path>
                  </svg>
                </button>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "discrete-slider": DiscreteSlider;
  }
}

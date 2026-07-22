import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("continuous-slider")
export class ContinuousSlider extends LitElement {
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 1;
  @property({ type: Number }) step = 0.1;
  @property({ type: Number }) value = 0.5;
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
      pointer-events: none;
    }
    .value-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 0.75rem;
      margin-bottom: 0.5rem;
    }
    .value-text {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--bluesky-text);
    }
    .slider-wrapper {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 9999px;
      padding: 0.5rem 0.75rem;
    }
    input[type="range"] {
      width: 100%;
      height: 8px;
      border-radius: 4px;
      background: var(--bluesky-border);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--bluesky-brand);
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    input[type="range"]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--bluesky-brand);
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  `;

  private _handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = parseFloat(input.value);
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: this.value },
      })
    );
  }

  render() {
    return html`
      <div class="slider-container ${this.disabled ? "disabled" : ""}">
        <div class="value-display">
          <span class="value-text">${this.value.toFixed(2)}</span>
        </div>
        <div class="slider-wrapper">
          <input
            type="range"
            min=${this.min}
            max=${this.max}
            step=${this.step}
            value=${this.value}
            ?disabled=${this.disabled}
            @input=${this._handleChange}
          />
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "continuous-slider": ContinuousSlider;
  }
}

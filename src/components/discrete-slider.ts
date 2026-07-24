import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("discrete-slider")
export class DiscreteSlider extends LitElement {
  @property({ type: Array }) options: string[] = [];
  @property({ type: Array }) iconSources: string[] = [];
  @property({ type: Number }) value = 0;
  @property({ type: Boolean }) disabled = false;
  @state() private _thumbPercent = 0;
  @state() private _isDragging = false;
  @state() private _previewIndex: number | null = null;
  @state() private _touchPreviewTimer: ReturnType<typeof setTimeout> | null = null;

  private _trackRect: DOMRect | null = null;
  private _dragStartX = 0;
  private _hasDragged = false;

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
      display: grid;
      padding: 0.5rem 0.75rem 0;
    }
    .label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--bluesky-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: center;
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
      transform: translate(-50%, 17px);
      width: 24px;
      height: 3px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
      box-shadow: 0 0 6px rgba(16, 131, 254, 0.55);
      pointer-events: none;
      z-index: 1;
    }
    .thumb.animate {
      transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .step-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      height: 40px;
      min-width: 0;
      position: relative;
      z-index: 2;
    }
    .step-icon {
      width: 30px;
      height: 30px;
      opacity: 0.5;
      transition: all 0.15s ease;
      pointer-events: none;
      object-fit: contain;
    }
    .step-icon-image {
      filter: grayscale(100%) drop-shadow(0 0 0.45px #71767b);
    }
    .step-icon-svg {
      fill: var(--bluesky-text-secondary);
    }
    .step-btn:hover .step-icon-svg {
      fill: #91bd3f;
      opacity: 0.85;
    }
    .step-btn:hover .step-icon-image {
      filter: grayscale(50%) drop-shadow(0 0 0.55px #91bd3f);
      opacity: 0.85;
    }
    .step-btn.active .step-icon {
      width: 32px;
      height: 32px;
      opacity: 1;
    }
    .step-btn.active .step-icon-svg {
      fill: #b4dc54;
    }
    .step-btn.active .step-icon-image {
      filter: grayscale(0%) drop-shadow(0 0 0.65px #b4dc54);
    }
    .step-btn.active:hover .step-icon-image {
      filter: grayscale(0%) drop-shadow(0 0 0.65px #b4dc54);
    }
    .step-btn:disabled {
      cursor: default;
    }
    .step-values {
      display: grid;
      padding: 0 0.75rem 0.5rem;
    }
    .step-value {
      min-width: 0;
      min-height: 0.875rem;
      color: var(--bluesky-text);
      font-size: 0.6875rem;
      font-weight: 600;
      line-height: 1.25;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 600px) {
      .slider-wrapper {
        padding-inline: 0.375rem;
      }
      .step-icon {
        width: 24px;
        height: 24px;
      }
      .step-btn.active .step-icon {
        width: 27px;
        height: 27px;
      }
      .thumb {
        width: 20px;
      }
      .step-values {
        display: block;
        text-align: center;
      }
      .step-value {
        display: inline;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._thumbPercent = this.#stepCenterPercent(this.value);
    window.addEventListener("mousemove", this.#onMouseMove);
    window.addEventListener("mouseup", this.#onMouseUp);
    window.addEventListener("touchmove", this.#onTouchMove, { passive: false });
    window.addEventListener("touchend", this.#onTouchEnd);
  }

  disconnectedCallback(): void {
    window.removeEventListener("mousemove", this.#onMouseMove);
    window.removeEventListener("mouseup", this.#onMouseUp);
    window.removeEventListener("touchmove", this.#onTouchMove);
    window.removeEventListener("touchend", this.#onTouchEnd);
    if (this._touchPreviewTimer) clearTimeout(this._touchPreviewTimer);
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has("value") && !this._isDragging) {
      this._thumbPercent = this.#stepCenterPercent(this.value);
    }
  }

  private _handleClick(index: number): void {
    if (this.disabled) return;
    this.#selectIndex(index);
    this.#showTouchPreview(index);
  }

  #selectIndex(index: number): void {
    const clampedIndex = Math.max(0, Math.min(this.options.length - 1, index));
    if (clampedIndex === this.value) return;
    this.value = clampedIndex;
    this._thumbPercent = this.#stepCenterPercent(clampedIndex);
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: clampedIndex },
      }),
    );
  }

  #stepCenterPercent(index: number): number {
    const n = this.options.length;
    if (n === 0) return 0;
    return ((index + 0.5) / n) * 100;
  }

  render() {
    return html`
      <div class="slider-container ${this.disabled ? "disabled" : ""}">
        <div
          class="step-values"
          style="grid-template-columns: repeat(${this.options.length}, minmax(0, 1fr));"
        >
          ${this.options.map(
            (option, index) => html`
              <div class="step-value">
                ${index === this._previewIndex ? option : ""}
              </div>
            `,
          )}
        </div>
        <div class="slider-wrapper">
          <div
            class="slider-track"
            @mousedown=${this.#onMouseDown}
            @touchstart=${this.#onTouchStart}
          >
            <div
              class="thumb ${this._isDragging ? "" : "animate"}"
              style="left: ${this._thumbPercent}%"
            ></div>
            ${this.options.map(
              (option, index) => html`
                <button
                  class="step-btn ${index === this.value ? "active" : ""}"
                  type="button"
                  aria-label=${option}
                  ?disabled=${this.disabled}
                  @click=${() => { this._handleClick(index); }}
                  @mouseenter=${() => { this._previewIndex = index; }}
                  @mouseleave=${() => { this._previewIndex = null; }}
                  @focus=${() => { this._previewIndex = index; }}
                  @blur=${() => { this._previewIndex = null; }}
                >
                  ${this.iconSources[index]
                    ? html`
                        <img
                          class="step-icon step-icon-image"
                          src=${this.iconSources[index]}
                          alt=""
                          width="18"
                          height="18"
                        />
                      `
                    : html`
                        <svg
                          class="step-icon step-icon-svg"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          aria-hidden="true"
                        >
                          <path d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"></path>
                        </svg>
                      `}
                </button>
              `
            )}
          </div>
        </div>
        <div
          class="labels-track"
          style="grid-template-columns: repeat(${this.options.length}, minmax(0, 1fr));"
        >
          ${this.options.map(
            (option, index) => html`
              <span class="label">
                ${index === 0 || index === this.options.length - 1 ? option : ""}
              </span>
            `,
          )}
        </div>
      </div>
    `;
  }

  #onMouseDown = (event: MouseEvent): void => {
    if (this.disabled) return;
    this._trackRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this._dragStartX = event.clientX;
    this._hasDragged = false;
    this._isDragging = false;
  };

  #onMouseMove = (event: MouseEvent): void => {
    if (!this._trackRect) return;
    if (Math.abs(event.clientX - this._dragStartX) > 3) {
      this._hasDragged = true;
      this._isDragging = true;
      this.#updateFromX(event.clientX);
      this._previewIndex = this.#indexFromPercent(this._thumbPercent);
    }
  };

  #onMouseUp = (event: MouseEvent): void => {
    if (!this._trackRect) return;
    if (this._hasDragged) {
      this.#snapToNearest();
    } else {
      this.#selectFromX(event.clientX);
    }
    this._trackRect = null;
    this._isDragging = false;
    this._hasDragged = false;
  };

  #onTouchStart = (event: TouchEvent): void => {
    this._trackRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = event.touches[0];
    if (!touch) return;
    this._dragStartX = touch.clientX;
    this._hasDragged = false;
    this._isDragging = false;
    this.#showTouchPreview(this.#indexFromX(touch.clientX));
  };

  #onTouchMove = (event: TouchEvent): void => {
    if (!this._trackRect) return;
    const touch = event.touches[0];
    if (!touch) return;
    if (Math.abs(touch.clientX - this._dragStartX) > 3) {
      this._hasDragged = true;
      event.preventDefault();
      this.#showTouchPreview(this.#touchIndexFromX(touch.clientX));
    }
  };

  #onTouchEnd = (): void => {
    if (!this._trackRect) return;
    if (this._hasDragged) {
      this.#showTouchPreview(this._previewIndex ?? this.value);
    } else if (this.disabled) {
      this.#showTouchPreview(this._previewIndex ?? this.value);
    } else {
      this.#selectFromX(this._dragStartX);
      this.#showTouchPreview(this.value);
    }
    this._trackRect = null;
    this._isDragging = false;
    this._hasDragged = false;
  };

  #updateFromX(clientX: number): void {
    if (!this._trackRect) return;
    const offset = clientX - this._trackRect.left;
    this._thumbPercent = Math.max(
      0,
      Math.min(100, (offset / this._trackRect.width) * 100),
    );
  }

  #selectFromX(clientX: number): void {
    this.#selectIndex(this.#indexFromX(clientX));
  }

  #indexFromX(clientX: number): number {
    if (!this._trackRect) return this.value;
    const percent = ((clientX - this._trackRect.left) / this._trackRect.width) * 100;
    return this.#indexFromPercent(percent);
  }

  #touchIndexFromX(clientX: number): number {
    const track = this.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    const rect = track?.getBoundingClientRect() ?? this._trackRect;
    if (!rect) return this.value;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return this.#indexFromPercent(percent);
  }

  #indexFromPercent(percent: number): number {
    const n = this.options.length;
    if (n === 0) return 0;
    return Math.max(0, Math.min(n - 1, Math.floor((percent / 100) * n)));
  }

  #snapToNearest(): void {
    this.#selectIndex(this.#indexFromPercent(this._thumbPercent));
    this._thumbPercent = this.#stepCenterPercent(this.value);
  }

  #showTouchPreview(index: number): void {
    this._previewIndex = index;
    if (this._touchPreviewTimer) clearTimeout(this._touchPreviewTimer);
    this._touchPreviewTimer = setTimeout(() => {
      this._previewIndex = null;
    }, 1500);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "discrete-slider": DiscreteSlider;
  }
}

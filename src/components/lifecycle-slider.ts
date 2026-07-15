import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

const STAGES = [
  { name: "eggs", src: "/assets/slider/Eggs-slider.png" },
  { name: "caterpillar", src: "/assets/slider/Caterpillar-slider.png" },
  { name: "chrysalis", src: "/assets/slider/chrysalis-slider.png" },
  { name: "emerging", src: "/assets/slider/emerging-slider.png" },
  { name: "butterfly", src: "/assets/slider/butterfly-slider.png" },
];

@customElement("lifecycle-slider")
export class LifecycleSlider extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: String }) leftLabel = "";
  @property({ type: String }) rightLabel = "";
  @property({ type: Number }) value = 0;
  @property({ type: Boolean }) disabled = false;
  @state() private _thumbPercent = 0;
  @state() private _isDragging = false;
  @state() private _showPopup = false;
  @state() private _popupTimer: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;

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
      pointer-events: none;
    }
    .labels-track {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      padding: 0 0.75rem;
      margin-bottom: 0.25rem;
    }
    .label-left,
    .label-right {
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
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
      box-shadow: 0 2px 8px rgba(16, 131, 254, 0.4);
      pointer-events: none;
      z-index: 1;
    }
    .thumb.animate {
      transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .stage-btn {
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
    .stage-icon {
      width: 26px;
      height: 26px;
      object-fit: contain;
      filter: grayscale(100%) opacity(0.35);
      transition: all 0.15s ease;
      pointer-events: none;
    }
    .stage-btn.active .stage-icon {
      filter: grayscale(0%) opacity(1);
      width: 30px;
      height: 30px;
    }
    .stage-btn:hover .stage-icon {
      filter: grayscale(50%) opacity(0.6);
    }
    .stage-btn.active:hover .stage-icon {
      filter: grayscale(0%) opacity(1);
    }
    .popup {
      position: absolute;
      bottom: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    }
    .popup-card {
      background: linear-gradient(135deg, rgba(30, 39, 50, 0.98) 0%, rgba(21, 32, 43, 0.99) 100%);
      border: 1px solid var(--bluesky-border);
      border-radius: 12px;
      padding: 0.75rem 1rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
      white-space: nowrap;
    }
    .popup-message {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--bluesky-brand);
      margin: 0;
    }
    @keyframes popIn {
      from {
        opacity: 0;
        transform: translateX(-50%) scale(0.9) translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) scale(1) translateY(0);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._thumbPercent = this.#stageCenterPercent(this.value);
    window.addEventListener("mousemove", this.#onMouseMove);
    window.addEventListener("mouseup", this.#onMouseUp);
    window.addEventListener("touchmove", this.#onTouchMove, { passive: false });
    window.addEventListener("touchend", this.#onTouchEnd);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("mousemove", this.#onMouseMove);
    window.removeEventListener("mouseup", this.#onMouseUp);
    window.removeEventListener("touchmove", this.#onTouchMove);
    window.removeEventListener("touchend", this.#onTouchEnd);
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has("value") && !this._isDragging) {
      const oldValue = changedProperties.get("value") as number;
      if (oldValue !== this.value) {
        this._thumbPercent = this.#stageCenterPercent(this.value);
        if (this._initialized) {
          this.#showPopup();
        }
        this._initialized = true;
      }
    }
  }

  render() {
    return html`
      <div class="slider-container ${this.disabled ? "disabled" : ""}">
        ${this._showPopup ? html`
          <div class="popup">
            <div class="popup-card">
              <p class="popup-message">Refresh your BlueSky Feed to see updates!</p>
            </div>
          </div>
        ` : ""}
        <div class="labels-track">
          <span class="label-left">${this.leftLabel}</span>
          <div></div>
          <div></div>
          <div></div>
          <span class="label-right">${this.rightLabel}</span>
        </div>
        <div class="slider-wrapper">
          <div
            class="slider-track"
            @mousedown=${this.#onMouseDown}
            @touchstart=${this.#onTouchStart}
          >
            <div class="thumb ${this._isDragging ? "" : "animate"}" style="left: ${this._thumbPercent}%"></div>
            ${STAGES.map(
              (stage, index) => html`
                <button
                  class="stage-btn ${index === this.value ? "active" : ""}"
                  aria-label="${stage.name}"
                  type="button"
                  ?disabled=${this.disabled}
                >
                  <img
                    class="stage-icon"
                    src=${stage.src}
                    alt=${stage.name}
                  />
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  #showPopup() {
    this._showPopup = true;
    if (this._popupTimer) clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(() => {
      this._showPopup = false;
    }, 3000);
  }

  #onMouseDown = (e: MouseEvent) => {
    this._trackRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._dragStartX = e.clientX;
    this._hasDragged = false;
    this._isDragging = false;
  };

  #onMouseMove = (e: MouseEvent) => {
    if (!this._trackRect) return;
    const dx = Math.abs(e.clientX - this._dragStartX);
    if (dx > 3) {
      this._hasDragged = true;
      this._isDragging = true;
      this.#updateFromX(e.clientX);
    }
  };

  #onMouseUp = (e: MouseEvent) => {
    if (!this._trackRect) return;
    if (this._hasDragged) {
      this._isDragging = false;
      this.#snapToNearest();
    } else {
      this.#animateToX(e.clientX);
    }
    this._trackRect = null;
    this._isDragging = false;
    this._hasDragged = false;
  };

  #onTouchStart = (e: TouchEvent) => {
    this._trackRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    if (touch) {
      this._dragStartX = touch.clientX;
      this._hasDragged = false;
      this._isDragging = false;
    }
  };

  #onTouchMove = (e: TouchEvent) => {
    if (!this._trackRect) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - this._dragStartX);
    if (dx > 3) {
      this._hasDragged = true;
      this._isDragging = true;
      e.preventDefault();
      this.#updateFromX(touch.clientX);
    }
  };

  #onTouchEnd = () => {
    if (!this._trackRect) return;
    if (this._hasDragged) {
      this._isDragging = false;
      this.#snapToNearest();
    }
    this._trackRect = null;
    this._isDragging = false;
    this._hasDragged = false;
  };

  #updateFromX(clientX: number) {
    if (!this._trackRect) return;
    const offset = clientX - this._trackRect.left;
    const percent = Math.max(0, Math.min(100, (offset / this._trackRect.width) * 100));
    this._thumbPercent = percent;
  }

  #animateToX(clientX: number) {
    if (!this._trackRect) return;
    const offset = clientX - this._trackRect.left;
    const percent = Math.max(0, Math.min(100, (offset / this._trackRect.width) * 100));
    const n = STAGES.length;
    const index = Math.floor((percent / 100) * n);
    const clampedIndex = Math.max(0, Math.min(n - 1, index));
    this.value = clampedIndex;
    this._thumbPercent = this.#stageCenterPercent(clampedIndex);
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: clampedIndex },
      }),
    );
  }

  #stageCenterPercent(index: number): number {
    const n = STAGES.length;
    return ((index + 0.5) / n) * 100;
  }

  #snapToNearest() {
    const n = STAGES.length;
    const index = Math.floor((this._thumbPercent / 100) * n);
    const clampedIndex = Math.max(0, Math.min(n - 1, index));
    this.value = clampedIndex;
    this._thumbPercent = this.#stageCenterPercent(clampedIndex);
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: clampedIndex },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lifecycle-slider": LifecycleSlider;
  }
}

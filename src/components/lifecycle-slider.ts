import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

const STAGES = [
  { name: "eggs", src: "/assets/slider/Eggs-slider.png" },
  { name: "caterpillar", src: "/assets/slider/Caterpillar-slider.png" },
  { name: "chrysalis", src: "/assets/slider/chrysalis-slider.png" },
  { name: "emerging", src: "/assets/slider/emerging-slider.png" },
  { name: "butterfly", src: "/assets/slider/butterfly-slider.png" },
];

export type LifecycleStageLabels = [
  string[],
  string[],
  string[],
  string[],
  string[],
];

@customElement("lifecycle-slider")
export class LifecycleSlider extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: String }) leftLabel = "";
  @property({ type: String }) rightLabel = "";
  @property({ type: Number }) value = 0;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Array }) stageLabels: LifecycleStageLabels = [[], [], [], [], []];
  @state() private _thumbPercent = 0;
  @state() private _isDragging = false;
  @state() private _previewStage: number | null = null;
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
      grid-template-columns: repeat(5, 1fr);
      padding: 0.5rem 0.75rem 0;
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
    .stage-values {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      padding: 0 0.75rem 0.5rem;
    }
    .stage-value {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;
      color: var(--bluesky-text-secondary);
      font-size: 0.6875rem;
      font-weight: 600;
      line-height: 1.25;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .stage-value.preview {
      color: var(--bluesky-text);
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
    if (this._touchPreviewTimer) clearTimeout(this._touchPreviewTimer);
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has("value") && !this._isDragging) {
      const oldValue = changedProperties.get("value") as number;
      if (oldValue !== this.value) {
        this._thumbPercent = this.#stageCenterPercent(this.value);
      }
    }
  }

  render() {
    return html`
      <div class="slider-container ${this.disabled ? "disabled" : ""}">
        <div class="stage-values">
          ${this.stageLabels.map(
            (lines, index) => html`
              <div class="stage-value ${index === this._previewStage ? "preview" : ""}">
                ${index === (this._previewStage ?? this.value)
                  ? lines.map((line) => html`<span>${line}</span>`)
                  : ""}
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
            <div class="thumb ${this._isDragging ? "" : "animate"}" style="left: ${this._thumbPercent}%"></div>
            ${STAGES.map(
              (stage, index) => html`
                <button
                  class="stage-btn ${index === this.value ? "active" : ""}"
                  aria-label="${stage.name}"
                  type="button"
                  ?disabled=${this.disabled}
                  @mouseenter=${() => { this._previewStage = index; }}
                  @mouseleave=${() => { this._previewStage = null; }}
                  @focus=${() => { this._previewStage = index; }}
                  @blur=${() => { this._previewStage = null; }}
                >
                  <img
                    class="stage-icon"
                    src=${stage.src}
                    alt=""
                    width="26"
                    height="26"
                  />
                </button>
              `,
            )}
          </div>
        </div>
        <div class="labels-track">
          <span class="label-left">${this.leftLabel}</span>
          <div></div>
          <div></div>
          <div></div>
          <span class="label-right">${this.rightLabel}</span>
        </div>
      </div>
    `;
  }

  #onMouseDown = (e: MouseEvent) => {
    if (this.disabled) return;
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
      this.#showTouchPreview(this.#stageIndexFromX(touch.clientX));
    }
  };

  #onTouchMove = (e: TouchEvent) => {
    if (!this._trackRect) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - this._dragStartX);
    if (dx > 3) {
      this._hasDragged = true;
      e.preventDefault();
      this.#showTouchPreview(this.#stageIndexFromX(touch.clientX));
    }
  };

  #onTouchEnd = () => {
    if (!this._trackRect) return;
    if (this._hasDragged) {
      this.#showTouchPreview(this._previewStage ?? this.value);
    } else if (this.disabled) {
      this.#showTouchPreview(this._previewStage ?? this.value);
    } else {
      this.#animateToX(this._dragStartX);
      this.#showTouchPreview(this.value);
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

  #stageIndexFromX(clientX: number): number {
    if (!this._trackRect) return this.value;
    const offset = clientX - this._trackRect.left;
    const percent = Math.max(0, Math.min(100, (offset / this._trackRect.width) * 100));
    return this.#stageIndexFromPercent(percent);
  }

  #stageIndexFromPercent(percent: number): number {
    const n = STAGES.length;
    return Math.max(0, Math.min(n - 1, Math.floor((percent / 100) * n)));
  }

  #snapToNearest() {
    const clampedIndex = this.#stageIndexFromPercent(this._thumbPercent);
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

  #showTouchPreview(index: number): void {
    this._previewStage = index;
    if (this._touchPreviewTimer) clearTimeout(this._touchPreviewTimer);
    this._touchPreviewTimer = setTimeout(() => {
      this._previewStage = null;
    }, 1500);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lifecycle-slider": LifecycleSlider;
  }
}

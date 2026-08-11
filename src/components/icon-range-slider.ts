import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export type IconRangeOrientation = "horizontal" | "vertical";

export function iconIndexForValue(
  value: number,
  min: number,
  max: number,
  iconCount: number,
): number {
  if (iconCount <= 1 || max <= min) return 0;
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Math.min(iconCount - 1, Math.floor(normalized * iconCount));
}

@customElement("icon-range-slider")
export class IconRangeSlider extends LitElement {
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 1;
  @property({ attribute: false }) scaleMin: number | null = null;
  @property({ attribute: false }) scaleMax: number | null = null;
  @property({ type: Number }) step = 0.01;
  @property({ type: Number }) value = 0;
  @property({ type: Array }) icons: string[] = [];
  @property({ type: String }) valueText = "";
  @property({ type: String }) ariaLabel = "Setting";
  @property({ type: String }) orientation: IconRangeOrientation = "horizontal";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) showValue = true;
  @property({ type: Number }) thumbIconSize = 30;
  private previewValue: number | null = null;

  static styles = css`
    :host {
      --icon-thumb-size: 40px;
      --icon-thumb-overhang: 20px;
      --icon-track-color: rgba(148, 163, 184, 0.3);
      --icon-fill-color: var(--bluesky-brand);
      --icon-tick-color: rgba(255, 255, 255, 0.35);
      display: block;
      min-width: 0;
    }

    .slider {
      display: grid;
      gap: 0.35rem;
      width: 100%;
      min-width: 0;
    }

    .value {
      color: var(--bluesky-text);
      font-size: 0.75rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
      text-align: center;
    }

    .range-shell {
      position: relative;
      width: calc(100% - var(--icon-thumb-size));
      margin-inline: var(--icon-thumb-overhang);
      min-width: 0;
      height: 44px;
    }

    .track,
    .fill {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 8px;
      border-radius: 9999px;
      transform: translateY(-50%);
      pointer-events: none;
    }

    .track {
      background: var(--icon-track-color);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
    }

    .fill {
      right: auto;
      background: var(--icon-fill-color);
    }

    .ticks {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 3px;
      pointer-events: none;
    }

    .tick {
      width: 2px;
      height: 10px;
      border-radius: 9999px;
      background: var(--icon-tick-color);
    }

    input[type="range"] {
      position: absolute;
      top: 0;
      bottom: 0;
      left: calc(-1 * var(--icon-thumb-overhang));
      z-index: 2;
      width: calc(var(--interactive-percent, 100%) + var(--icon-thumb-size));
      height: 44px;
      margin: 0;
      opacity: 0;
      cursor: pointer;
      touch-action: pan-y;
      -webkit-tap-highlight-color: transparent;
    }

    input[type="range"]:focus-visible + .icon-thumb {
      outline: 3px solid rgba(145, 189, 63, 0.65);
      outline-offset: 3px;
    }

    .icon-thumb {
      position: absolute;
      top: 50%;
      z-index: 1;
      display: grid;
      place-items: center;
      width: var(--icon-thumb-size);
      height: var(--icon-thumb-size);
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.75);
      border-radius: 9999px;
      background: var(--bluesky-bg-card);
      box-shadow:
        0 3px 10px rgba(0, 0, 0, 0.35),
        0 0 0 2px rgba(16, 131, 254, 0.25);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: left 120ms ease, top 120ms ease;
    }

    .icon-thumb img {
      max-width: 30px;
      max-height: 30px;
      object-fit: contain;
    }

    .disabled {
      opacity: 0.42;
    }

    .disabled input[type="range"] {
      cursor: not-allowed;
    }

    .vertical {
      width: 48px;
      height: 100%;
      min-height: 220px;
      grid-template-rows: 1fr auto;
      justify-items: center;
    }

    .vertical .range-shell {
      width: 44px;
      height: calc(100% - var(--icon-thumb-size));
      min-height: 180px;
      margin: var(--icon-thumb-overhang) 0;
      grid-row: 1;
    }

    .vertical .track,
    .vertical .fill {
      top: 0;
      bottom: 0;
      left: 50%;
      right: auto;
      width: 8px;
      height: auto;
      transform: translateX(-50%);
    }

    .vertical .fill {
      bottom: auto;
    }

    .vertical .ticks {
      flex-direction: column;
      padding: 3px 0;
    }

    .vertical .tick {
      width: 10px;
      height: 2px;
    }

    .vertical input[type="range"] {
      top: calc(-1 * var(--icon-thumb-overhang));
      bottom: auto;
      left: 0;
      width: 44px;
      height: calc(100% + var(--icon-thumb-size));
      writing-mode: vertical-lr;
      direction: ltr;
      touch-action: pan-x;
    }

    .vertical .icon-thumb {
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .vertical .value {
      max-width: 54px;
    }

    @media (max-width: 375px) {
      :host {
        --icon-thumb-size: 36px;
        --icon-thumb-overhang: 18px;
      }

      .icon-thumb img {
        max-width: 26px;
        max-height: 26px;
      }
    }
  `;

  render() {
    const percent = this.#percent();
    const scaleMin = this.scaleMin ?? this.min;
    const scaleMax = this.scaleMax ?? this.max;
    const icon = this.icons[
      iconIndexForValue(this.value, scaleMin, scaleMax, this.icons.length)
    ];
    const vertical = this.orientation === "vertical";
    const positionStyle = vertical
      ? `top: ${String(percent)}%;`
      : `left: ${String(percent)}%;`;
    const fillStyle = vertical
      ? `height: ${String(percent)}%;`
      : `width: ${String(percent)}%;`;
    const shellStyle = vertical
      ? ""
      : `--interactive-percent: ${String(this.#interactivePercent())}%;`;
    const displayValue = this.valueText || this.value.toFixed(2);

    return html`
      <div class="slider ${vertical ? "vertical" : ""} ${this.disabled ? "disabled" : ""}">
        <div class="range-shell" style=${shellStyle}>
          <div class="track"></div>
          <div class="fill" style=${fillStyle}></div>
          <div class="ticks" aria-hidden="true">
            ${this.icons.map(() => html`<span class="tick"></span>`)}
          </div>
          <input
            type="range"
            min=${this.min}
            max=${this.max}
            step=${this.step}
            .value=${String(this.value)}
            ?disabled=${this.disabled}
            aria-label=${this.ariaLabel}
            aria-valuemin=${this.min}
            aria-valuemax=${this.max}
            aria-valuenow=${this.value}
            aria-valuetext=${displayValue}
            aria-orientation=${this.orientation}
            @input=${this.#handleInput}
            @change=${this.#handleChange}
            @pointerup=${this.#handlePointerEnd}
            @pointercancel=${this.#handlePointerEnd}
          />
          <span class="icon-thumb" style=${positionStyle} aria-hidden="true">
            ${icon
              ? html`<img
                  src=${icon}
                  alt=""
                  width=${this.thumbIconSize}
                  height=${this.thumbIconSize}
                  style=${`width: ${String(this.thumbIconSize)}px; height: ${String(this.thumbIconSize)}px;`}
                />`
              : ""}
          </span>
        </div>
        ${this.showValue
          ? html`<div class="value" aria-hidden="true">${displayValue}</div>`
          : ""}
      </div>
    `;
  }

  #percent(): number {
    const scaleMin = this.scaleMin ?? this.min;
    const scaleMax = this.scaleMax ?? this.max;
    if (scaleMax <= scaleMin) return 0;
    return Math.max(
      0,
      Math.min(100, ((this.value - scaleMin) / (scaleMax - scaleMin)) * 100),
    );
  }

  #interactivePercent(): number {
    const scaleMin = this.scaleMin ?? this.min;
    const scaleMax = this.scaleMax ?? this.max;
    if (scaleMax <= scaleMin) return 100;
    return Math.max(
      0,
      Math.min(100, ((this.max - scaleMin) / (scaleMax - scaleMin)) * 100),
    );
  }

  #handleInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.previewValue = Number(input.value);
    this.value = this.previewValue;
    this.dispatchEvent(
      new CustomEvent("slider-preview", {
        bubbles: true,
        composed: true,
        detail: { value: this.value },
      }),
    );
  };

  #handleChange = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.#commitValue(this.previewValue ?? Number(input.value));
  };

  #handlePointerEnd = (): void => {
    // A live parent rerender can prevent Safari and some touch browsers from
    // delivering the range input's final `change` event. Let the native event
    // run first, then commit the last preview only when it did not arrive.
    queueMicrotask(() => {
      if (this.previewValue !== null) this.#commitValue(this.previewValue);
    });
  };

  #commitValue(value: number): void {
    this.value = value;
    this.previewValue = null;
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: this.value },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "icon-range-slider": IconRangeSlider;
  }
}

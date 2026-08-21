import { css } from "lit";

export const settingsPageStyles = css`
  :host {
    display: block;
  }

  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--bluesky-border);
    background: rgba(21, 32, 43, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
  }

  h1 {
    flex: 1;
    margin: 0;
    color: var(--bluesky-text);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .reset-defaults-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 40px;
    flex-shrink: 0;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 9999px;
    background: var(--bluesky-bg-card);
    color: var(--bluesky-text);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      color 150ms ease;
  }

  .reset-defaults-btn:hover:not(:disabled) {
    border-color: var(--bluesky-text-secondary);
    background: var(--bluesky-bg-hover);
  }

  .reset-defaults-btn:focus-visible {
    outline: 2px solid var(--bluesky-brand);
    outline-offset: 2px;
  }

  .reset-defaults-btn:disabled {
    color: var(--bluesky-text-secondary);
    cursor: default;
    opacity: 0.58;
  }

  .reset-defaults-btn > svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    fill: currentColor;
  }

  .reset-label-short {
    display: none;
  }

  .hamburger-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--bluesky-text);
    cursor: pointer;
  }

  .hamburger-btn svg {
    width: 22px;
    height: 22px;
  }

  .page-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(100dvh - 60px);
    padding: 1.25rem 0.5rem 3rem;
  }

  .diagram-wrapper,
  feedback-form {
    width: 100%;
    max-width: 560px;
    box-sizing: border-box;
  }

  .section {
    width: calc(100% - 0.5rem);
    margin-inline: 0.25rem;
    padding: 1rem 0.75rem;
    border-radius: 16px;
    box-sizing: border-box;
  }

  .section-candidate {
    border: 1px solid rgba(99, 102, 241, 0.25);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.08));
    box-shadow: 0 4px 24px rgba(99, 102, 241, 0.1);
  }

  .section-ranking {
    border: 1px solid rgba(168, 85, 247, 0.25);
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(139, 92, 246, 0.08));
    box-shadow: 0 4px 24px rgba(168, 85, 247, 0.1);
  }

  .section-diversification {
    border: 1px solid rgba(34, 197, 94, 0.25);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08));
    box-shadow: 0 4px 24px rgba(34, 197, 94, 0.1);
  }

  .section-title {
    margin: 0 0 0.875rem;
    color: #93b4f5;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-align: center;
  }

  .section-ranking .section-title {
    color: #c4a0f7;
  }

  .section-diversification .section-title {
    color: #6ee7a0;
  }

  .control-card {
    min-width: 0;
    padding: 0.75rem;
    border-radius: 12px;
    box-sizing: border-box;
    color: #fff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      filter 150ms ease;
  }

  .control-card:focus-within {
    z-index: 1;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
  }

  @media (hover: hover) and (pointer: fine) {
    .control-card:hover {
      z-index: 1;
      filter: brightness(1.06);
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
    }
  }

  .saved-settings-loading {
    display: grid;
    place-items: center;
    width: min(560px, 100%);
    min-height: 15rem;
    box-sizing: border-box;
    color: var(--bluesky-text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: center;
  }

  .config-card {
    margin-bottom: 0.75rem;
    border: 1px solid rgba(253, 186, 116, 0.28);
    background: linear-gradient(145deg, #a94f45, #a86f32);
  }

  .source-card {
    background: linear-gradient(145deg, #3b82f6, #2563eb);
  }

  .signal-card {
    background: linear-gradient(145deg, #a855f7, #7c3aed);
  }

  .component-title {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin: -0.35rem 0 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    transition:
      background 0.15s,
      transform 0.15s;
  }

  .component-title-text {
    min-width: 0;
  }

  .question-icon {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    margin-left: 0.35rem;
    border: 1px solid currentColor;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-style: normal;
    font-weight: 800;
    line-height: 1;
    opacity: 0.82;
  }

  .component-title:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: -3px;
  }

  .component-title:active {
    transform: scale(0.98);
  }

  .sources-layout {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 0.625rem;
    align-items: stretch;
  }

  .source-controls-help {
    width: 100%;
    margin: 0 0 0.625rem;
    color: rgba(226, 232, 240, 0.76);
    font-size: 0.6875rem;
    line-height: 1.35;
    text-align: center;
  }

  .master-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .master-end-label {
    color: rgba(226, 232, 240, 0.82);
    font-size: 0.625rem;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: 0.01em;
    text-align: center;
    text-transform: uppercase;
  }

  .master-column icon-range-slider {
    flex: 1;
    min-height: 330px;
  }

  .source-slider-card icon-range-slider {
    --icon-track-color: rgba(239, 246, 255, 0.56);
    --icon-fill-color: #163b70;
    --icon-tick-color: rgba(255, 255, 255, 0.82);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-width: 0;
  }

  .source-adjustment-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px;
    gap: 0.5rem;
    align-items: stretch;
    min-width: 0;
  }

  .source-slider-card {
    min-width: 0;
    padding: 0.65rem 0.625rem;
  }

  .source-editor {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.4rem;
    align-items: center;
  }

  .percentage-field {
    display: flex;
    width: 44px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 44px;
    padding-inline: 0.2rem;
    border: 1px solid rgba(255, 255, 255, 0.62);
    border-radius: 9px;
    background: rgba(37, 99, 235, 0.42);
    box-sizing: border-box;
    color: #fff;
    transition:
      opacity 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .percentage-field:focus-within {
    outline: 3px solid rgba(255, 255, 255, 0.72);
    outline-offset: 2px;
  }

  .percentage-input {
    width: 1.65rem;
    min-width: 0;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
    appearance: textfield;
  }

  .percentage-input::-webkit-inner-spin-button,
  .percentage-input::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
  }

  .percentage-field:has(.percentage-input[aria-invalid="true"]),
  .percentage-field:has(.percentage-input:invalid) {
    border-color: #f87171;
    outline: 2px solid #ef4444;
    outline-offset: 1px;
  }

  .percentage-suffix {
    color: rgba(255, 255, 255, 0.82);
    font-size: 0.75rem;
    font-weight: 800;
  }

  .source-lock-btn {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.58);
    border-radius: 9px;
    background: rgba(37, 99, 235, 0.42);
    color: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    transition:
      opacity 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .source-lock-btn[aria-pressed="true"] {
    border-color: #dcfce7;
    background: #166534;
    color: #fff;
    box-shadow: 0 0 0 2px rgba(220, 252, 231, 0.25);
  }

  .source-lock-btn:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.75);
    outline-offset: 2px;
  }

  .source-editor.is-locked .percentage-field,
  .source-editor.is-derived .percentage-field {
    border-color: rgba(148, 163, 184, 0.32);
    background: rgba(71, 85, 105, 0.48);
    color: rgba(226, 232, 240, 0.72);
    opacity: 0.58;
  }

  .source-lock-btn:disabled {
    cursor: not-allowed;
    border-color: rgba(148, 163, 184, 0.32);
    background: rgba(71, 85, 105, 0.48);
    color: rgba(226, 232, 240, 0.72);
    opacity: 0.58;
  }

  .percentage-input:disabled {
    cursor: not-allowed;
    opacity: 1;
  }

  .source-lock-btn svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .master-lock-note {
    max-width: 48px;
    margin-top: 0.25rem;
    color: rgba(226, 232, 240, 0.68);
    font-size: 0.5625rem;
    font-weight: 700;
    line-height: 1.15;
    text-align: center;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .fixed-source {
    display: grid;
    place-items: center;
    min-height: 74px;
  }

  .fixed-source .component-title {
    margin: 0;
  }

  .ranking-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .penalties {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
  }

  .penalty-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    border: 0;
    border-radius: 9999px;
    background: linear-gradient(145deg, #f59e0b, #d97706);
    color: #fff;
    font-size: 0.75rem;
    font-style: italic;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 3px 12px rgba(245, 158, 11, 0.3);
    transition:
      transform 150ms ease,
      filter 150ms ease,
      box-shadow 150ms ease;
  }

  .penalty-pill:hover,
  .penalty-pill:focus-visible {
    filter: brightness(1.08);
    outline: 2px solid rgba(255, 255, 255, 0.65);
    outline-offset: 2px;
    transform: translateY(-2px);
    box-shadow: 0 7px 18px rgba(245, 158, 11, 0.4);
  }

  .arrow-connector {
    display: grid;
    place-items: center;
    height: 36px;
  }

  .arrow-connector svg {
    width: 20px;
    height: 36px;
  }

  .arrow-line {
    stroke: rgba(148, 163, 184, 0.5);
    stroke-width: 2;
  }

  .arrow-head {
    fill: rgba(148, 163, 184, 0.6);
  }

  .politics-card {
    grid-column: 1 / -1;
    width: 100%;
    box-sizing: border-box;
    padding: 1rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 14px;
    background: var(--bluesky-bg-card);
  }

  .politics-heading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .politics-heading .component-title {
    width: auto;
    margin: 0;
    color: var(--bluesky-text);
  }

  .coming-soon {
    color: var(--bluesky-text-secondary);
    font-size: 0.6875rem;
    font-style: italic;
    font-weight: 600;
  }

  .politics-control {
    opacity: 0.55;
  }

  feedback-form {
    margin-top: 1.5rem;
  }

  .refresh-popup {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 4.75rem);
    left: 0.75rem;
    right: 0.75rem;
    z-index: 200;
    width: min(32rem, calc(100vw - 1.5rem));
    margin-inline: auto;
    padding: clamp(0.55rem, 1vw, 0.75rem) clamp(0.9rem, 2vw, 1.25rem);
    border: 1px solid var(--bluesky-border);
    border-radius: 12px;
    background: rgba(21, 32, 43, 0.98);
    color: var(--bluesky-brand);
    font-size: clamp(0.8125rem, calc(0.72rem + 0.3vw), 1rem);
    font-weight: 600;
    box-sizing: border-box;
    line-height: 1.2;
    text-align: center;
    white-space: normal;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .refresh-popup:hover {
    background: rgba(30, 44, 58, 0.98);
  }

  @media (min-width: 768px) {
    .refresh-popup {
      top: calc(env(safe-area-inset-top, 0px) + 5.5rem);
    }
  }

  @media (min-width: 1024px) {
    .refresh-popup {
      right: auto;
      left: calc(50% + 137.5px);
      margin-inline: 0;
      transform: translateX(-50%);
    }
  }

  .popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .popup-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
  }

  .popup-card {
    position: relative;
    width: min(420px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 16px;
    box-sizing: border-box;
    overflow-y: auto;
    background: linear-gradient(135deg, rgba(30, 39, 50, 0.98), rgba(21, 32, 43, 0.99));
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  .popup-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .popup-title {
    margin: 0;
    color: var(--bluesky-text);
    font-size: 1rem;
  }

  .popup-close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: var(--bluesky-text);
    cursor: pointer;
  }

  .popup-description {
    margin: 0.75rem 0 0;
    color: var(--bluesky-text-secondary);
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .popup-values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-top: 0.75rem;
  }

  .popup-detail-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .popup-detail-row .popup-more {
    flex-shrink: 0;
    margin: 0.75rem 0 0 auto;
  }

  .popup-metric {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .popup-metric-label {
    color: var(--bluesky-text-secondary);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .popup-metric-value {
    color: var(--bluesky-text);
    font-size: 0.9375rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .popup-more {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 44px;
    margin-top: 0.5rem;
    color: var(--bluesky-brand);
    font-size: 0.875rem;
    font-weight: 700;
    text-decoration: none;
  }

  .popup-more:hover {
    text-decoration: underline;
  }

  .popup-more:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--bluesky-brand);
    outline-offset: 3px;
  }

  .popup-more svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  @media (min-width: 480px) {
    .page-content {
      padding: 2rem 0.75rem 3rem;
    }

    .section {
      width: calc(100% - 1rem);
      margin-inline: 0.5rem;
      padding: 1.25rem 1rem;
    }

    .ranking-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1023px) {
    .hamburger-btn {
      display: flex;
    }
  }

  @media (max-width: 340px) {
    .header-row {
      gap: 0.5rem;
      padding-inline: 0.75rem;
    }

    h1 {
      font-size: 1.125rem;
    }

    .reset-defaults-btn {
      min-height: 36px;
      padding-inline: 0.6rem;
    }

    .reset-label-long {
      display: none;
    }

    .reset-label-short {
      display: inline;
    }

    .page-content {
      padding-inline: 0.25rem;
    }

    .section {
      width: 100%;
      margin-inline: 0;
      padding-inline: 0.5rem;
    }

    .sources-layout {
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 0.35rem;
    }

    .control-card {
      padding-inline: 0.5rem;
    }

    .source-adjustment-row {
      gap: 0.35rem;
    }

    .source-slider-card {
      padding-inline: 0.125rem;
    }

    .source-slider-card icon-range-slider {
      --icon-thumb-size: 32px;
      --icon-thumb-overhang: 16px;
    }
  }
`;

import { css } from "lit";

export const settingsPageStyles = css`
  :host {
    display: block;
  }

  .settings-layout {
    min-height: 100dvh;
  }

  .controls-column {
    min-width: 0;
  }

  .feed-column {
    display: none;
    min-width: 0;
  }

  .preview-header {
    position: relative;
    display: flex;
    min-height: var(--theme-header-height);
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--bluesky-border);
    box-sizing: border-box;
  }

  .update-preview-btn,
  .mobile-preview-btn,
  .history-btn {
    min-height: 36px;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 999px;
    background: var(--bluesky-bg-card);
    color: var(--bluesky-text);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }

  .update-preview-btn {
    display: none;
    min-height: 44px;
    padding: 0.6rem 1.25rem;
    border-color: var(--bluesky-brand);
    background: var(--bluesky-brand);
    color: var(--bluesky-on-brand);
    font-size: 0.875rem;
    white-space: nowrap;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--bluesky-brand) 30%, transparent);
  }

  .preview-progress {
    position: relative;
    display: inline-block;
    line-height: 1;
    white-space: nowrap;
  }

  .preview-butterfly {
    position: absolute;
    top: 50%;
    left: calc(100% + 0.375rem);
    width: 1rem;
    height: 1rem;
    object-fit: contain;
    pointer-events: none;
    transform-origin: center;
    animation: preview-butterfly-breathe 900ms cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  @keyframes preview-butterfly-breathe {
    0%,
    100% {
      transform: translateY(-50%) scale(1.12);
    }

    50% {
      transform: translateY(-50%) scale(0.65);
    }
  }

  .mobile-preview-btn {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    padding-inline: 1rem;
    border-color: var(--bluesky-brand);
    background: var(--bluesky-brand);
    color: var(--bluesky-on-brand);
    font-size: 0.8125rem;
    box-shadow: 0 3px 12px color-mix(in srgb, var(--bluesky-brand) 28%, transparent);
  }

  .history-btn {
    display: inline-flex;
    width: auto;
    min-width: 0;
    height: 36px;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.35rem 0.55rem;
    border-color: var(--bluesky-border);
    background: transparent;
  }

  .history-btn wa-icon {
    width: 1.125rem;
    height: 1.125rem;
    flex: none;
    font-size: 1.125rem;
  }

  .preview-mobile-primary-actions {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 0.4rem;
  }

  .preview-mobile-primary-actions::after {
    width: 36px;
    height: 1px;
    content: "";
  }

  .mobile-preview-status {
    grid-column: 2;
    justify-self: center;
    color: var(--bluesky-text);
    font-size: 1.125rem;
    font-weight: 800;
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
  }

  .update-preview-btn:hover:not(:disabled),
  .mobile-preview-btn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--bluesky-brand) 82%, white);
    background: color-mix(in srgb, var(--bluesky-brand) 86%, black);
  }

  .history-btn:hover:not(:disabled) {
    border-color: var(--bluesky-brand);
    background: var(--bluesky-bg-hover);
  }

  .update-preview-btn:focus-visible,
  .mobile-preview-btn:focus-visible,
  .history-btn:focus-visible {
    outline: 2px solid var(--bluesky-brand);
    outline-offset: 2px;
  }

  .update-preview-btn:disabled,
  .mobile-preview-btn:disabled,
  .history-btn:disabled {
    color: var(--bluesky-text-secondary);
    cursor: default;
    opacity: 0.5;
  }

  .update-preview-btn:disabled,
  .mobile-preview-btn:disabled {
    border-color: var(--bluesky-border);
    background: var(--bluesky-bg-card);
    box-shadow: none;
  }

  .update-preview-btn.is-generating:disabled {
    padding-right: 1.75rem;
    padding-left: 1rem;
    border-color: color-mix(in srgb, var(--bluesky-brand) 82%, white);
    background: color-mix(in srgb, var(--bluesky-brand) 88%, black);
    color: var(--bluesky-on-brand);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--bluesky-brand) 30%, transparent);
    cursor: progress;
    opacity: 1;
  }

  .preview-header h2 {
    margin: 0.1rem 0 0;
    color: var(--bluesky-text);
    font-size: 0.9375rem;
  }

  .preview-eyebrow {
    color: var(--bluesky-text-secondary);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .preview-close,
  .preview-error button {
    min-height: 36px;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 999px;
    background: var(--bluesky-bg-card);
    color: var(--bluesky-text);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 650;
    cursor: pointer;
  }

  .preview-close:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .preview-close {
    display: inline-grid;
    width: 36px;
    min-width: 36px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    place-items: center;
  }

  .preview-close wa-icon {
    width: 1.125rem;
    height: 1.125rem;
    font-size: 1.125rem;
  }

  .preview-close:focus-visible {
    outline: 2px solid var(--bluesky-brand);
    outline-offset: 2px;
  }

  .preview-viewport {
    position: relative;
    min-height: 0;
    flex: 1;
  }

  .feed-scroll {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .preview-surface {
    min-height: 100%;
    opacity: 1;
    transition: opacity 180ms ease;
  }

  .preview-viewport.is-generating .preview-surface {
    opacity: 0.24;
  }

  .preview-viewport.is-busy .feed-scroll {
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: none;
  }

  .preview-generation-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    display: grid;
    background: color-mix(in srgb, var(--bluesky-bg) 24%, transparent);
    pointer-events: auto;
    place-items: center;
    touch-action: none;
  }

  .preview-generation-overlay wa-spinner {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--bluesky-brand);
    font-size: 2.5rem;
  }

  .preview-movement-help {
    margin: 0;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--bluesky-border);
    color: var(--bluesky-text-secondary);
    font-size: 0.75rem;
    line-height: 1.35;
    text-align: center;
  }

  .settings-error {
    margin: 0.75rem 1rem 0;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--bluesky-border);
    border-radius: 0.75rem;
    background: var(--bluesky-bg-card);
    color: var(--bluesky-text-secondary);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .preview-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0;
    padding: 0.6rem 0.9rem;
    border-top: 1px solid var(--bluesky-border);
    color: var(--bluesky-text-secondary);
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--bluesky-border);
    backdrop-filter: var(--theme-glass-blur);
    -webkit-backdrop-filter: var(--theme-glass-blur);
  }

  .header-row {
    display: flex;
    /* the 1px is the sticky header's own bottom line */
    min-height: calc(var(--theme-header-height) - 1px);
    box-sizing: border-box;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1.5rem;
  }

  h1 {
    flex: 1;
    margin: 0;
    color: var(--bluesky-text);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .page-title-short {
    display: none;
  }

  .mobile-preview-row {
    display: flex;
    min-width: 0;
    max-width: 8.75rem;
    flex: 1 1 0;
  }

  .mobile-preview-row .mobile-preview-btn {
    width: 100%;
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
    padding: 0.75rem 0.375rem 2rem;
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
    padding: 0.75rem 0.625rem;
    border-radius: 16px;
    box-sizing: border-box;
    /* the glow sits on the section, not on the tinted cards nested inside it */
    box-shadow: var(--theme-box-glow);
  }

  .section-candidate {
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-blue) 8%, transparent);
  }

  .section-ranking {
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-cyan) 8%, transparent);
  }

  .section-diversification {
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-yellow) 8%, transparent);
  }

  .section-title {
    margin: 0 0 0.5rem;
    color: var(--theme-fg);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-align: center;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    margin-bottom: 0.5rem;
  }

  .section-heading .section-title {
    margin: 0;
  }

  .section-info-btn {
    position: relative;
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--theme-blue);
    font-family: inherit;
    cursor: pointer;
  }

  .section-info-btn::before {
    position: absolute;
    width: 44px;
    height: 44px;
    content: "";
  }

  .section-info-btn .question-icon {
    margin: 0;
  }

  .section-info-btn:focus-visible {
    border-radius: 9999px;
    outline: 2px solid currentColor;
    outline-offset: 1px;
  }


  .control-card {
    min-width: 0;
    padding: 0.5rem;
    border-radius: 12px;
    box-sizing: border-box;
    color: var(--theme-fg);
  }

  .control-card:focus-within {
    z-index: 1;
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
    margin-bottom: 0.5rem;
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-blue) 16%, transparent);
  }

  .source-card {
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-blue) 16%, transparent);
  }

  .signal-card {
    border: 1px solid var(--theme-box-border);
    background: color-mix(in srgb, var(--theme-cyan) 16%, transparent);
  }

  .component-title {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 32px;
    margin: -0.2rem 0 0;
    padding: 0.1rem 0.375rem;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
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
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    margin-left: 0.25rem;
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
    min-width: 0;
  }

  .source-slider-card icon-range-slider {
    --icon-track-color: color-mix(in srgb, var(--theme-fg) 28%, transparent);
    --icon-fill-color: var(--bluesky-fill);
    --icon-tick-color: color-mix(in srgb, var(--theme-fg) 82%, transparent);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .source-slider-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 38px;
    grid-template-rows: auto auto;
    column-gap: 0.125rem;
    align-items: center;
    min-width: 0;
    padding: 0.375rem 0.5rem;
  }

  .source-slider-main {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
  }

  .source-slider-card > .component-title {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .source-lock-btn {
    grid-column: 2;
    grid-row: 1 / 3;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    transform: translateX(-7px);
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--theme-fg) 58%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--theme-blue) 25%, transparent);
    color: color-mix(in srgb, var(--theme-fg) 90%, transparent);
    cursor: pointer;
    transition:
      opacity 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .source-lock-btn[aria-pressed="true"] {
    border-color: var(--theme-yellow-bright);
    background: var(--theme-green-bright);
    color: var(--theme-bg);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-green-bright) 30%, transparent);
  }

  .source-lock-btn:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-fg) 75%, transparent);
    outline-offset: 2px;
  }

  .source-lock-btn:disabled {
    cursor: not-allowed;
    border-color: color-mix(in srgb, var(--theme-mute) 32%, transparent);
    background: color-mix(in srgb, var(--theme-dim) 48%, transparent);
    color: color-mix(in srgb, var(--theme-fg) 72%, transparent);
    opacity: 0.58;
  }

  .source-lock-btn svg {
    width: 17px;
    height: 17px;
    fill: currentColor;
  }

  .fixed-source {
    display: grid;
    place-items: center;
    min-height: 62px;
  }

  .fixed-source .component-title {
    margin: 0;
  }

  .ranking-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .penalties {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }

  .penalty-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    border: 0;
    border-radius: 9999px;
    background: var(--bluesky-bg-card);
    color: var(--theme-fg);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .penalty-pill:hover,
  .penalty-pill:focus-visible {
    background: var(--bluesky-bg-hover);
  }

  .penalty-pill:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-fg) 65%, transparent);
    outline-offset: 2px;
  }

  .arrow-connector {
    display: grid;
    place-items: center;
    height: 26px;
  }

  .arrow-connector svg {
    width: 20px;
    height: 26px;
  }

  .arrow-line {
    stroke: color-mix(in srgb, var(--theme-mute) 50%, transparent);
    stroke-width: 2;
  }

  .arrow-head {
    fill: color-mix(in srgb, var(--theme-mute) 60%, transparent);
  }

  .politics-card {
    grid-column: 1 / -1;
  }

  feedback-form {
    margin-top: 1.5rem;
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
    border: 1px solid var(--theme-box-border);
    border-radius: 16px;
    box-sizing: border-box;
    overflow-y: auto;
    background: var(--theme-pane);
    backdrop-filter: var(--theme-glass-blur);
    -webkit-backdrop-filter: var(--theme-glass-blur);
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
    background: color-mix(in srgb, var(--theme-fg) 10%, transparent);
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
      padding: 1.25rem 0.75rem 2.5rem;
    }

    .section {
      width: calc(100% - 1rem);
      margin-inline: 0.5rem;
      padding: 1rem 0.75rem;
    }

    .ranking-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preview-butterfly {
      animation: none;
      transform: translateY(-50%);
    }

    .preview-surface {
      transition: none;
    }
  }

  @media (max-width: 1023px) {
    .hamburger-btn {
      display: flex;
    }

    .header-row {
      gap: 0.25rem;
      padding: 0.65rem 1rem;
    }

    h1 {
      min-width: max-content;
      overflow: visible;
      font-size: 1.125rem;
      line-height: 1.25;
      text-overflow: clip;
      white-space: nowrap;
    }

    .header-row > .mobile-preview-row,
    .header-row > .history-btn,
    .header-row > .reset-defaults-btn {
      width: auto;
      min-width: 0;
      max-width: 8.75rem;
      min-height: 40px;
      flex: 1 1 0;
    }

    .header-row > .history-btn {
      height: 40px;
      gap: 0.2rem;
      padding-inline: 0.6rem;
      font-size: 0.75rem;
    }

    .header-row > .history-btn wa-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }

    .reset-defaults-btn {
      min-height: 36px;
      padding-inline: 0.7rem;
      font-size: 0.75rem;
    }

    .reset-defaults-btn {
      gap: 0.35rem;
    }
  }

  @media (max-width: 767px) {
    .header-row {
      display: grid;
      grid-template-columns: 36px max-content minmax(0, 1fr) repeat(3, minmax(0, 6.25rem));
      gap: 0.35rem;
      padding: 0.6rem 0.5rem;
    }

    .hamburger-btn {
      grid-row: 1;
      grid-column: 1;
    }

    h1 {
      grid-row: 1;
      grid-column: 2;
    }

    .page-title-full {
      display: none;
    }

    .page-title-short {
      display: inline;
    }

    .mobile-preview-row {
      grid-row: 1;
      grid-column: 4;
    }

    .history-btn {
      grid-row: 1;
      grid-column: 5;
    }

    .reset-defaults-btn {
      grid-row: 1;
      grid-column: 6;
    }

    .mobile-preview-row .mobile-preview-btn,
    .header-row > .history-btn,
    .header-row > .reset-defaults-btn {
      max-width: none;
      min-height: 38px;
      padding-inline: 0.45rem;
      font-size: 0.75rem;
    }

    .header-row > .history-btn {
      height: 38px;
    }

    .preview-header {
      gap: 0.25rem;
      padding-inline: 0.5rem;
    }
  }

  @media (max-width: 479px) {
    .header-row {
      grid-template-columns: 36px max-content minmax(0, 1fr) auto auto;
    }

    .hamburger-btn {
      grid-column: 1;
    }

    h1 {
      grid-column: 2;
    }

    .history-btn {
      grid-row: 1;
      grid-column: 4;
      justify-self: end;
    }

    .reset-defaults-btn {
      grid-row: 1;
      grid-column: 5;
    }

    .header-row > .mobile-preview-row {
      grid-row: 2;
      grid-column: 1 / -1;
      width: 100%;
      max-width: none;
      justify-content: center;
      margin-top: 0.15rem;
    }

    .mobile-preview-row .mobile-preview-btn {
      width: min(75%, 18rem);
      min-height: 44px;
      font-size: 0.8125rem;
    }
  }

  @media (max-width: 1023px) {
    .mobile-preview-open .controls-column {
      opacity: 0;
      pointer-events: none;
    }

    .mobile-preview-open .feed-column {
      position: fixed;
      inset: 0;
      z-index: 400;
      display: flex;
      flex-direction: column;
      height: 100dvh;
    }
  }

  @media (min-width: 1024px) {
    :host,
    .settings-layout {
      height: 100dvh;
      min-height: 0;
      overflow: hidden;
    }

    .settings-layout {
      display: grid;
      grid-template-columns: minmax(28rem, 1.15fr) minmax(18rem, 0.85fr);
    }

    .controls-column {
      overflow-y: auto;
      overscroll-behavior: contain;
      border-right: 1px solid var(--bluesky-border);
    }

    .feed-column {
      position: relative;
      display: flex;
      min-height: 0;
      flex-direction: column;
    }

    .preview-close {
      display: none;
    }

    .preview-mobile-primary-actions,
    .mobile-preview-row,
    .mobile-preview-btn {
      display: none;
    }

    .update-preview-btn {
      position: absolute;
      left: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transform: translateX(-50%);
    }

    .update-preview-btn.is-status:disabled {
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--bluesky-text);
      font-size: 1.125rem;
      font-weight: 800;
      line-height: 1.1;
      box-shadow: none;
      cursor: default;
      opacity: 1;
    }

    .update-preview-btn.is-status.is-generating:disabled {
      padding-right: 1.75rem;
      cursor: progress;
    }
  }

  @media (max-width: 340px) {
    h1 {
      font-size: 1.125rem;
    }

    .history-btn {
      gap: 0.3rem;
      padding-inline: 0.4rem;
      font-size: 0.75rem;
    }

    .mobile-preview-btn {
      padding-inline: 0.65rem;
      font-size: 0.8125rem;
    }

    .reset-defaults-btn {
      min-height: 40px;
      padding-inline: 0.6rem;
    }

    .page-content {
      padding-inline: 0.25rem;
    }

    .section {
      width: 100%;
      margin-inline: 0;
      padding-inline: 0.5rem;
    }

    .control-card {
      padding-inline: 0.5rem;
    }

    .source-slider-card {
      padding-inline: 0.25rem;
    }

    .source-slider-card icon-range-slider {
      --icon-thumb-size: 28px;
      --icon-thumb-overhang: 14px;
      --icon-control-height: 32px;
    }
  }

  @media (max-width: 300px) {
    .header-row {
      grid-template-columns: 32px max-content minmax(0, 1fr) auto auto;
      gap: 0.125rem;
      padding: 0.4rem 0.375rem 0.5rem;
    }

    h1 {
      grid-row: 1;
      grid-column: 2;
      font-size: 1rem;
      text-align: left;
    }

    .history-btn {
      grid-row: 1;
      grid-column: 4;
      min-height: 36px;
      justify-self: end;
    }

    .reset-defaults-btn {
      grid-row: 1;
      grid-column: 5;
      min-height: 36px;
      gap: 0;
      padding-inline: 0.35rem;
      font-size: 0.6875rem;
    }

    .reset-defaults-btn > svg {
      display: none;
    }

    .mobile-preview-row .mobile-preview-btn {
      width: 75%;
      min-height: 42px;
      padding-inline: 0.35rem;
      font-size: 0.75rem;
    }

    .hamburger-btn {
      width: 32px;
    }
  }

  @media (max-width: 260px) {
    .history-btn {
      width: 36px;
      padding: 0;
    }

    .history-btn span {
      display: none;
    }
  }
`;

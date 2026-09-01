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
    background: var(--bluesky-bg, #0f1720);
  }

  .preview-header {
    position: relative;
    display: flex;
    min-height: 60px;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--bluesky-border);
    box-sizing: border-box;
    background: rgba(21, 32, 43, 0.94);
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
    color: #fff;
    font-size: 0.875rem;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--bluesky-brand) 30%, transparent);
  }

  .mobile-preview-btn {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    padding-inline: 1rem;
    border-color: var(--bluesky-brand);
    background: var(--bluesky-brand);
    color: #fff;
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

  .feed-scroll {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
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
    background: rgba(21, 32, 43, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 1.5rem;
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
    margin: 0 0 0.5rem;
    color: #93b4f5;
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
    color: #93b4f5;
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

  .section-ranking .section-title {
    color: #c4a0f7;
  }

  .section-diversification .section-title {
    color: #6ee7a0;
  }

  .control-card {
    min-width: 0;
    padding: 0.5rem;
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
    margin-bottom: 0.5rem;
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
    --icon-track-color: rgba(239, 246, 255, 0.56);
    --icon-fill-color: #163b70;
    --icon-tick-color: rgba(255, 255, 255, 0.82);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .source-slider-card {
    position: relative;
    min-width: 0;
    padding: 0.375rem 0.5rem;
  }

  .source-slider-card .component-title {
    box-sizing: border-box;
    padding-inline: 2.4rem;
  }

  .source-lock-btn {
    position: absolute;
    top: 0.375rem;
    right: 0.5rem;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
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

  .source-lock-btn:disabled {
    cursor: not-allowed;
    border-color: rgba(148, 163, 184, 0.32);
    background: rgba(71, 85, 105, 0.48);
    color: rgba(226, 232, 240, 0.72);
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
    height: 26px;
  }

  .arrow-connector svg {
    width: 20px;
    height: 26px;
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

    .source-lock-btn {
      right: 0.25rem;
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

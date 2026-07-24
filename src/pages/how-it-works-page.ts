import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getRootStore } from "../main";
import { FRESHNESS_PRESETS } from "../constants/preferences";

interface DiagramNode {
  id: string;
  label: string;
  subtitle?: string;
  type: "source" | "signal" | "penalty" | "config";
  description: string;
}

const DIAGRAM_NODES: Record<string, DiagramNode> = {
  time_window: {
    id: "time_window",
    label: "Time window",
    type: "config",
    description:
      "Defines the lookback period for candidate posts. Only posts within this window are considered for the feed.",
  },
  following: {
    id: "following",
    label: "Following",
    type: "source",
    description: "Posts from accounts you follow. Weighted to balance familiarity with discovery.",
  },
  authors_topics: {
    id: "authors_topics",
    label: "Authors and Topics",
    type: "source",
    description:
      "Posts from authors and topics you've expressed interest in, even if you don't follow them directly.",
  },
  popular: {
    id: "popular",
    label: "Popular",
    type: "source",
    description: "Trending posts across the network that are gaining rapid engagement.",
  },
  predict_like: {
    id: "predict_like",
    label: "Predict p(like)",
    type: "signal",
    description:
      "ML model that predicts the probability you'll like a post based on your historical behavior.",
  },
  constructiveness: {
    id: "constructiveness",
    label: "Constructiveness",
    subtitle: "(Perspective API)",
    type: "signal",
    description:
      "Uses Google's Perspective Bridging API to score how constructive and healthy a post's content is.",
  },
  engaging_constructive: {
    id: "engaging_constructive",
    label: "Engaging vs. Constructive",
    type: "config",
    description:
      "Balances engagement signals (likes, replies) with constructiveness scores to promote healthy, interesting content over purely viral posts.",
  },
  repeated_author: {
    id: "repeated_author",
    label: "Repeated author penalty",
    type: "penalty",
    description:
      "Reduces ranking of posts from authors who already appear multiple times in your feed, promoting diversity.",
  },
  repeated_topic: {
    id: "repeated_topic",
    label: "Repeated topic penalty",
    type: "penalty",
    description:
      "Reduces ranking of posts on topics you've already seen recently, ensuring topic variety.",
  },
};

@customElement("how-it-works-page")
export class HowItWorksPage extends LitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;
  @state() private _selectedNode: string | null = null;

  static styles = css`
    :host {
      display: block;
    }

    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 30;
      background: rgba(21, 32, 43, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--bluesky-border);
    }

    .page-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 0.75rem 3rem;
      min-height: calc(100dvh - 60px);
    }

    .diagram-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      width: 100%;
      max-width: 560px;
    }

    .section {
      width: 100%;
      border-radius: 16px;
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      position: relative;
      box-sizing: border-box;
      margin-left: 0.75rem;
      margin-right: 0.75rem;
      width: calc(100% - 1.5rem);
    }

    .section-candidate {
      background: linear-gradient(
        135deg,
        rgba(59, 130, 246, 0.12) 0%,
        rgba(99, 102, 241, 0.08) 100%
      );
      border: 1px solid rgba(99, 102, 241, 0.25);
      box-shadow:
        0 4px 24px rgba(99, 102, 241, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .section-signals {
      background: linear-gradient(
        135deg,
        rgba(168, 85, 247, 0.12) 0%,
        rgba(139, 92, 246, 0.08) 100%
      );
      border: 1px solid rgba(168, 85, 247, 0.25);
      box-shadow:
        0 4px 24px rgba(168, 85, 247, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .section-diversification {
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.12) 0%,
        rgba(16, 185, 129, 0.08) 100%
      );
      border: 1px solid rgba(34, 197, 94, 0.25);
      box-shadow:
        0 4px 24px rgba(34, 197, 94, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--bluesky-text);
      margin: 0 0 0.25rem 0;
      letter-spacing: 0.02em;
    }

    .section-candidate .section-title {
      color: #93b4f5;
    }
    .section-signals .section-title {
      color: #c4a0f7;
    }
    .section-diversification .section-title {
      color: #6ee7a0;
    }

    .sources-row {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      align-items: center;
    }

    .source-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .source-row .node-box {
      width: auto;
      min-width: 100px;
    }

    .weight-pill {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #6ee7a0;
      font-size: 0.6875rem;
      font-weight: 600;
      font-style: italic;
      padding: 0.1875rem 0.625rem;
      border-radius: 9999px;
      cursor: pointer;
      transition:
        transform 0.15s ease,
        background 0.15s ease;
    }

    .weight-pill:hover {
      transform: scale(1.08);
      background: rgba(34, 197, 94, 0.3);
    }

    .node-box {
      width: 100%;
      padding: 0.625rem 0.375rem;
      border-radius: 10px;
      text-align: center;
      cursor: pointer;
      transition:
        transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.2s ease,
        filter 0.2s ease;
      position: relative;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      box-sizing: border-box;
    }

    .node-box:hover {
      transform: translateY(-3px) scale(1.03);
      filter: brightness(1.15);
    }

    .node-box:active {
      transform: translateY(-1px) scale(0.98);
    }

    .node-box.selected {
      transform: translateY(-3px) scale(1.03);
      filter: brightness(1.2);
    }

    .node-box-source {
      background: linear-gradient(145deg, #3b82f6 0%, #2563eb 100%);
      box-shadow:
        0 4px 16px rgba(59, 130, 246, 0.35),
        0 2px 4px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-weight: 700;
      font-size: 0.8125rem;
      line-height: 1.3;
    }

    .node-box-signal {
      background: linear-gradient(145deg, #a855f7 0%, #7c3aed 100%);
      box-shadow:
        0 4px 16px rgba(168, 85, 247, 0.35),
        0 2px 4px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-weight: 700;
      font-size: 0.8125rem;
      line-height: 1.3;
    }

    .node-box-config {
      background: linear-gradient(145deg, #22c55e 0%, #16a34a 100%);
      box-shadow:
        0 4px 16px rgba(34, 197, 94, 0.3),
        0 2px 4px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-weight: 600;
      font-size: 0.75rem;
      font-style: italic;
    }

    .node-box-penalty {
      background: linear-gradient(145deg, #f59e0b 0%, #d97706 100%);
      box-shadow:
        0 4px 16px rgba(245, 158, 11, 0.3),
        0 2px 4px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-weight: 600;
      font-size: 0.75rem;
      font-style: italic;
    }

    .config-pill {
      background: linear-gradient(145deg, #22c55e 0%, #16a34a 100%);
      box-shadow:
        0 3px 12px rgba(34, 197, 94, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      font-style: italic;
      padding: 0.4375rem 1rem;
      border-radius: 9999px;
      cursor: pointer;
      transition:
        transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.2s ease,
        filter 0.2s ease;
    }

    .config-pill:hover {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.15);
      box-shadow:
        0 6px 20px rgba(34, 197, 94, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    .config-pill:active {
      transform: translateY(-1px) scale(0.98);
    }

    .config-pill.selected {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.2);
    }

    .penalty-pill {
      background: linear-gradient(145deg, #f59e0b 0%, #d97706 100%);
      box-shadow:
        0 3px 12px rgba(245, 158, 11, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      font-style: italic;
      padding: 0.4375rem 0.875rem;
      border-radius: 9999px;
      cursor: pointer;
      transition:
        transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.2s ease,
        filter 0.2s ease;
    }

    .penalty-pill:hover {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.15);
      box-shadow:
        0 6px 20px rgba(245, 158, 11, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    .penalty-pill:active {
      transform: translateY(-1px) scale(0.98);
    }

    .penalty-pill.selected {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.2);
    }

    .arrow-connector {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      width: 100%;
      position: relative;
    }

    .arrow-connector svg {
      width: 20px;
      height: 36px;
    }

    .arrow-line {
      stroke: rgba(148, 163, 184, 0.5);
      stroke-width: 2;
      fill: none;
    }

    .arrow-head {
      fill: rgba(148, 163, 184, 0.6);
    }

    .signals-row {
      display: flex;
      gap: 1rem;
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }

    .signal-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 0 0 160px;
      min-width: 120px;
      max-width: 180px;
      box-sizing: border-box;
    }

    .node-subtitle {
      font-size: 0.625rem;
      font-weight: 500;
      opacity: 0.85;
      margin-top: 0.125rem;
    }

    .engaging-pill {
      background: linear-gradient(145deg, #22c55e 0%, #16a34a 100%);
      box-shadow:
        0 3px 12px rgba(34, 197, 94, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      font-style: italic;
      padding: 0.4375rem 0.875rem;
      border-radius: 9999px;
      cursor: pointer;
      transition:
        transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.2s ease,
        filter 0.2s ease;
    }

    .engaging-pill:hover {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.15);
      box-shadow:
        0 6px 20px rgba(34, 197, 94, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    .engaging-pill:active {
      transform: translateY(-1px) scale(0.98);
    }

    .engaging-pill.selected {
      transform: translateY(-3px) scale(1.05);
      filter: brightness(1.2);
    }

    .penalties-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .popup-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    .popup-card {
      position: relative;
      width: 100%;
      max-width: 380px;
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      background: linear-gradient(135deg, rgba(30, 39, 50, 0.98) 0%, rgba(21, 32, 43, 0.99) 100%);
      border: 1px solid var(--bluesky-border);
      box-shadow:
        0 16px 48px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes popIn {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .popup-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .popup-title {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      flex: 1;
      min-width: 0;
    }

    .popup-title.type-source {
      color: #60a5fa;
    }
    .popup-title.type-signal {
      color: #c084fc;
    }
    .popup-title.type-config {
      color: #4ade80;
    }
    .popup-title.type-penalty {
      color: #fbbf24;
    }

    .popup-badge {
      font-size: 0.625rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .badge-source {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }
    .badge-signal {
      background: rgba(168, 85, 247, 0.2);
      color: #c084fc;
    }
    .badge-config {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .badge-penalty {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }

    .popup-description {
      font-size: 0.875rem;
      color: var(--bluesky-text-secondary);
      line-height: 1.6;
      margin: 0;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .popup-value {
      margin-top: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: var(--bluesky-text);
    }

    .popup-close {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: var(--bluesky-text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      transition: background 0.15s;
    }

    .popup-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: var(--bluesky-text);
    }

    @media (max-width: 399px) {
      .section {
        padding: 0.875rem 0.5rem;
        margin-left: 0.5rem;
        margin-right: 0.5rem;
        width: calc(100% - 1rem);
      }

      .section-title {
        font-size: 0.875rem;
      }

      .node-box {
        padding: 0.5rem 0.375rem;
        font-size: 0.75rem;
      }

      .node-box-source,
      .node-box-signal {
        font-size: 0.75rem;
      }

      .node-box-config,
      .node-box-penalty {
        font-size: 0.6875rem;
      }

      .config-pill {
        font-size: 0.75rem;
        padding: 0.375rem 0.75rem;
      }

      .penalty-pill,
      .engaging-pill {
        font-size: 0.6875rem;
        padding: 0.375rem 0.625rem;
      }
    }

    @media (min-width: 400px) and (max-width: 479px) {
      .signal-column {
        min-width: 110px;
        max-width: 160px;
        flex: 0 0 140px;
      }

      .signal-column .node-box {
        padding-left: 1rem;
        padding-right: 1rem;
      }
    }

    @media (min-width: 480px) {
      .page-content {
        padding: 2rem 1rem 3rem;
      }

      .section {
        padding: 1.25rem 1rem;
        margin-left: 1rem;
        margin-right: 1rem;
        width: calc(100% - 2rem);
      }

      .section-title {
        font-size: 1rem;
      }

      .sources-row {
        flex-direction: row;
        gap: 1.25rem;
        justify-content: center;
        flex-wrap: wrap;
      }

      .source-row {
        flex-direction: column;
        gap: 0.5rem;
        flex: 1;
        min-width: 110px;
        max-width: 160px;
      }

      .source-row .node-box {
        width: 100%;
        min-width: 0;
      }

      .weight-pill {
        position: static;
        transform: none;
        writing-mode: horizontal-tb;
        padding: 0.1875rem 0.625rem;
        font-size: 0.6875rem;
        align-self: center;
      }

      .node-box {
        padding: 0.75rem 0.5rem;
        font-size: 0.875rem;
      }

      .node-box-source,
      .node-box-signal {
        font-size: 0.875rem;
      }

      .node-box-config,
      .node-box-penalty {
        font-size: 0.8125rem;
      }

      .config-pill {
        font-size: 0.875rem;
        padding: 0.5rem 1.25rem;
      }

      .penalty-pill,
      .engaging-pill {
        font-size: 0.8125rem;
        padding: 0.5rem 1rem;
      }

      .signals-row {
        gap: 1rem;
      }

      .signal-column {
        min-width: 130px;
        max-width: 200px;
        flex: 0 0 160px;
      }

      .signal-column .node-box {
        padding-left: 1rem;
        padding-right: 1rem;
      }

      .node-subtitle {
        font-size: 0.6875rem;
      }

      .popup-card {
        max-width: 420px;
      }
    }

    @media (min-width: 768px) {
      .section {
        margin-left: 1.25rem;
        margin-right: 1.25rem;
        width: calc(100% - 2.5rem);
      }

      .sources-row {
        gap: 1.5rem;
      }

      .source-row {
        min-width: 120px;
        max-width: 170px;
      }

      .node-box {
        padding: 0.875rem 0.5rem;
      }

      .node-box-source,
      .node-box-signal {
        font-size: 0.9375rem;
      }

      .signals-row {
        gap: 1rem;
      }

      .signal-column .node-box {
        padding-left: 1.25rem;
        padding-right: 1.25rem;
      }

      .signal-column {
        min-width: 140px;
        max-width: 200px;
        flex: 0 0 180px;
      }

      .popup-card {
        max-width: 460px;
      }
    }
  `;

  #handleNodeClick(nodeId: string) {
    this._selectedNode = this._selectedNode === nodeId ? null : nodeId;
  }

  #closeDetail() {
    this._selectedNode = null;
  }

  #renderArrow() {
    return html`
      <div class="arrow-connector">
        <svg viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg">
          <line class="arrow-line" x1="12" y1="0" x2="12" y2="32" />
          <polygon class="arrow-head" points="6,30 12,40 18,30" />
        </svg>
      </div>
    `;
  }

  #renderPopup() {
    if (!this._selectedNode) return html``;
    const node = DIAGRAM_NODES[this._selectedNode];
    if (!node) return html``;

    const root = getRootStore();
    const prefs = root?.preferencesStore.values;

    let valueDisplay = html``;

    if (node.id === "time_window" && prefs) {
      const freshness = FRESHNESS_PRESETS[prefs.freshness];
      valueDisplay = html`
        <div class="popup-value"><strong>Current:</strong> ${freshness?.label ?? "7d"}</div>
      `;
    } else if (node.id === "following" && prefs) {
      const weights = root.preferencesStore.socialRadiusWeights;
      const followingWeight = weights.find((w) => w.name === "followed_users")?.weight ?? 0;
      valueDisplay = html`
        <div class="popup-value"><strong>Weight:</strong> ${followingWeight.toFixed(2)}</div>
      `;
    } else if (node.id === "authors_topics" && prefs) {
      const weights = root.preferencesStore.socialRadiusWeights;
      const twoTowerWeight = weights.find((w) => w.name === "two_tower")?.weight ?? 0;
      valueDisplay = html`
        <div class="popup-value"><strong>Weight:</strong> ${twoTowerWeight.toFixed(2)}</div>
      `;
    } else if (node.id === "popular" && prefs) {
      const weights = root.preferencesStore.socialRadiusWeights;
      const popularWeight = weights.find((w) => w.name === "popularity")?.weight ?? 0;
      valueDisplay = html`
        <div class="popup-value"><strong>Weight:</strong> ${popularWeight.toFixed(2)}</div>
      `;
    } else if (node.id === "engaging_constructive" && prefs) {
      valueDisplay = html`
        <div class="popup-value">
          <strong>Engaging:</strong> ${(1 - prefs.purpose).toFixed(2)},
          <strong>Constructive:</strong> ${prefs.purpose.toFixed(2)}
        </div>
      `;
    }

    return html`
      <div class="popup-overlay" @click=${this.#closeDetail}>
        <div class="popup-backdrop"></div>
        <div
          class="popup-card"
          @click=${(e: Event) => {
          e.stopPropagation();
        }}
        >
          <div class="popup-header">
            <h3 class="popup-title type-${node.type}">
              ${node.label}
              <span class="popup-badge badge-${node.type}">${node.type}</span>
            </h3>
            <button class="popup-close" @click=${this.#closeDetail} aria-label="Close detail">
              &times;
            </button>
          </div>
          <p class="popup-description">${node.description}</p>
          ${valueDisplay}
        </div>
      </div>
    `;
  }

  render() {
    const root = getRootStore();
    const weights = root?.preferencesStore.socialRadiusWeights ?? [];

    const followingWeight = weights.find((w) => w.name === "followed_users")?.weight ?? 0;
    const twoTowerWeight = weights.find((w) => w.name === "two_tower")?.weight ?? 0;
    const popularWeight = weights.find((w) => w.name === "popularity")?.weight ?? 0;

    return html`
      <div class="sticky-header">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.5rem;">
          <button
            class="hamburger-btn"
            @click=${() => this.onOpenMenu?.()}
            aria-label="Open navigation"
            type="button"
            style="display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9999px; border: none; background: transparent; color: var(--bluesky-text); cursor: pointer; flex-shrink: 0;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="width: 22px; height: 22px;"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 class="text-xl font-bold" style="color: var(--bluesky-text); margin: 0; flex: 1;">
            How It Works
          </h1>
        </div>
        <style>
          @media (max-width: 1023px) {
            .hamburger-btn {
              display: flex !important;
            }
          }
        </style>
      </div>

      <div class="page-content">
        <div class="diagram-wrapper">
          <div class="section section-candidate">
            <h2 class="section-title">Candidate Sources</h2>
            <div
              class="config-pill ${this._selectedNode === "time_window" ? "selected" : ""}"
              @click=${() => {
                this.#handleNodeClick("time_window");
              }}
            >
              Time window
            </div>
            <div class="sources-row">
              <div class="source-row">
                <div
                  class="node-box node-box-source ${this._selectedNode === "following" ? "selected" : ""}"
                  @click=${() => {
                    this.#handleNodeClick("following");
                  }}
                >
                  Following
                </div>
                <div
                  class="weight-pill"
                  @click=${() => {
                  this.#handleNodeClick("following");
                }}
                >
                  ${followingWeight.toFixed(2)}
                </div>
              </div>
              <div class="source-row">
                <div
                  class="node-box node-box-source ${this._selectedNode === "authors_topics" ? "selected" : ""}"
                  @click=${() => {
                    this.#handleNodeClick("authors_topics");
                  }}
                >
                  Authors and Topics
                </div>
                <div
                  class="weight-pill"
                  @click=${() => {
                  this.#handleNodeClick("authors_topics");
                }}
                >
                  ${twoTowerWeight.toFixed(2)}
                </div>
              </div>
              <div class="source-row">
                <div
                  class="node-box node-box-source ${this._selectedNode === "popular" ? "selected" : ""}"
                  @click=${() => {
                    this.#handleNodeClick("popular");
                  }}
                >
                  Popular
                </div>
                <div
                  class="weight-pill"
                  @click=${() => {
                  this.#handleNodeClick("popular");
                }}
                >
                  ${popularWeight.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          ${this.#renderArrow()}

          <div class="section section-signals">
            <h2 class="section-title">Signals</h2>
            <div class="signals-row">
              <div class="signal-column">
                <div
                  class="node-box node-box-signal ${this._selectedNode === "predict_like" ? "selected" : ""}"
                  @click=${() => {
                    this.#handleNodeClick("predict_like");
                  }}
                >
                  Predict<br />p(like)
                </div>
              </div>
              <div class="signal-column">
                <div
                  class="node-box node-box-signal ${this._selectedNode === "constructiveness" ? "selected" : ""}"
                  @click=${() => {
                    this.#handleNodeClick("constructiveness");
                  }}
                >
                  Constructiveness
                  <div class="node-subtitle">(Perspective API)</div>
                </div>
              </div>
            </div>
            <div
              class="engaging-pill ${this._selectedNode === "engaging_constructive" ? "selected" : ""}"
              @click=${() => {
                this.#handleNodeClick("engaging_constructive");
              }}
            >
              Engaging vs. Constructive
            </div>
          </div>

          ${this.#renderArrow()}

          <div class="section section-diversification">
            <h2 class="section-title">Diversification</h2>
            <div class="penalties-row">
              <div
                class="penalty-pill ${this._selectedNode === "repeated_author" ? "selected" : ""}"
                @click=${() => {
                  this.#handleNodeClick("repeated_author");
                }}
              >
                Repeated author penalty
              </div>
              <div
                class="penalty-pill ${this._selectedNode === "repeated_topic" ? "selected" : ""}"
                @click=${() => {
                  this.#handleNodeClick("repeated_topic");
                }}
              >
                Repeated topic penalty
              </div>
            </div>
          </div>
        </div>
      </div>

      ${this.#renderPopup()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "how-it-works-page": HowItWorksPage;
  }
}

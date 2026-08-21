import { html, type TemplateResult } from "lit";
import type { AlgorithmId } from "../constants/algorithms";
import { FRESHNESS_PRESETS } from "../constants/preferences";
import type { SourceWeights } from "../services/types";
import { formatWeight, SETTINGS_NODES } from "./settings-page-config";

interface SettingsDetailDialogOptions {
  nodeId: string | null;
  weights: SourceWeights;
  purpose: number;
  freshness: number;
  selectedAlgorithm: AlgorithmId;
  onClose: () => void;
}

function metrics(values: Array<[string, string]>): TemplateResult {
  return html`
    <div class="popup-values">
      ${values.map(
        ([label, value]) => html`
          <span class="popup-metric">
            <span class="popup-metric-label">${label}</span>
            <span class="popup-metric-value">${value}</span>
          </span>
        `,
      )}
    </div>
  `;
}

function popupValues(options: SettingsDetailDialogOptions): TemplateResult {
  const { nodeId, weights, purpose, freshness, selectedAlgorithm } = options;
  if (nodeId === "time_window") {
    return metrics([["Current", FRESHNESS_PRESETS[freshness]?.label ?? "7d"]]);
  }
  if (nodeId === "following") {
    return selectedAlgorithm === "your-feed"
      ? metrics([["Weight", formatWeight(weights.following)]])
      : html``;
  }
  if (nodeId === "network_likes") {
    return metrics([["Weight", formatWeight(weights.networkLikes)]]);
  }
  if (nodeId === "authors_topics") {
    return metrics([["Weight", formatWeight(weights.authorsTopics)]]);
  }
  if (nodeId === "popular") return metrics([["Weight", formatWeight(weights.popular)]]);
  if (nodeId === "predict_like") return metrics([["Weight", (1 - purpose).toFixed(2)]]);
  if (nodeId === "constructiveness") return metrics([["Weight", purpose.toFixed(2)]]);
  if (nodeId === "politics") return metrics([["Current", "1.00 · Neutral"]]);
  return html``;
}

export function renderSettingsDetailDialog(options: SettingsDetailDialogOptions): TemplateResult {
  const { nodeId, onClose, selectedAlgorithm } = options;
  if (!nodeId) return html``;
  const node = SETTINGS_NODES[nodeId];
  if (!node) return html``;
  const description =
    nodeId === "following" && selectedAlgorithm === "best-of-friends"
      ? "Posts from accounts you follow."
      : node.description;

  return html`
    <div class="popup-overlay" @click=${onClose}>
      <div class="popup-backdrop"></div>
      <div
        class="popup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-popup-title"
        @click=${(event: Event) => {
          event.stopPropagation();
        }}
      >
        <div class="popup-header">
          <h3 class="popup-title" id="settings-popup-title">${node.label}</h3>
          <button class="popup-close" type="button" aria-label="Close detail" @click=${onClose}>
            &times;
          </button>
        </div>
        <p class="popup-description">${description}</p>
        ${
          nodeId === "constructiveness"
            ? html`
                <div class="popup-detail-row">
                  ${popupValues(options)}
                  <a
                    class="popup-more"
                    href="https://www.greenearth.social/p/what-does-constructive-mean"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="More about Constructive (opens in a new tab)"
                  >
                    <span>More</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 3h6v6"></path>
                      <path d="M10 14 21 3"></path>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    </svg>
                  </a>
                </div>
              `
            : popupValues(options)
        }
      </div>
    </div>
  `;
}

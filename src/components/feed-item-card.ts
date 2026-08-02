import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import type { AlgorithmId } from "../constants/algorithms";
import { getRootStore } from "../main";
import { compactRelativeTime } from "../utils/relative-time";
import "./rank-scores-chart";

const COUNTED_MEDIA_LABEL = /^(?:(\d+)\s+)?(images?|videos?|links?)$/i;

function countedMediaLabels(item: FeedItemView): string[] {
  const bareCounts = new Map<string, number>();
  for (const label of item.mediaLabels) {
    const match = COUNTED_MEDIA_LABEL.exec(label.trim());
    if (!match?.[2] || match[1]) continue;
    const singular = match[2].toLowerCase().replace(/s$/, "");
    bareCounts.set(singular, (bareCounts.get(singular) ?? 0) + 1);
  }

  const emittedBareLabels = new Set<string>();
  return item.mediaLabels.flatMap((label) => {
    const match = COUNTED_MEDIA_LABEL.exec(label.trim());
    if (!match?.[2]) return [label];

    const singular = match[2].toLowerCase().replace(/s$/, "");
    const explicitCount = match[1] ? Number.parseInt(match[1], 10) : null;
    if (explicitCount === null && emittedBareLabels.has(singular)) return [];

    const repeatedLabelCount = bareCounts.get(singular) ?? 0;
    const itemCount =
      singular === "image"
        ? item.imageUrls.length
        : singular === "video"
          ? item.videoUrl
            ? 1
            : 0
          : item.linkCard
            ? 1
            : 0;
    const count = explicitCount ?? (repeatedLabelCount > 1 ? repeatedLabelCount : itemCount);
    if (explicitCount === null) emittedBareLabels.add(singular);
    if (count <= 0) return [];

    return [`${String(count)} ${singular}${count === 1 ? "" : "s"}`];
  });
}

@customElement("feed-item-card")
export class FeedItemCard extends MobxLitElement {
  @property({ type: Object }) item: FeedItemView | null = null;
  @property({ attribute: false }) algorithmId: AlgorithmId | null = null;
  @property({ type: Number }) engagingInfluence = 0.5;
  @property({ type: Number }) constructiveInfluence = 0.5;

  static styles = css`
    :host {
      display: block;
      margin: 0.5rem 0.75rem 0.5rem 1.5rem;
    }
    .card {
      background: var(--bluesky-bg-card);
      border: 1px solid var(--bluesky-border);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      transition: background 0.15s;
      max-width: 100%;
    }
    .card:hover {
      background: var(--bluesky-bg-hover);
    }
    .author-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .author-info {
      min-width: 120px;
      flex: 1;
    }
    .display-name {
      font-weight: 700;
      font-size: 0.9375rem;
      color: var(--bluesky-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .handle {
      font-size: 0.8125rem;
      color: var(--bluesky-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .post-time::before {
      content: " · ";
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: var(--bluesky-brand);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .author-actions {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .content-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.1);
      color: var(--bluesky-text);
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-weight: 500;
      white-space: nowrap;
    }
    .bluesky-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      font-size: 1rem;
      color: var(--bluesky-brand);
      background: transparent;
      border: 1.5px solid var(--bluesky-brand);
      cursor: pointer;
      text-decoration: none;
      transition:
        background 0.15s,
        color 0.15s;
      flex-shrink: 0;
    }
    .bluesky-btn:hover {
      background: rgba(16, 131, 254, 0.12);
      color: var(--bluesky-brand-hover);
    }
    .bluesky-btn wa-icon {
      font-size: 0.875rem;
    }
    .post-content {
      font-size: 0.9375rem;
      line-height: 1.45;
      color: var(--bluesky-text);
      margin-top: 0.5rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chart-section {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--bluesky-border);
    }
  `;

  render() {
    if (!this.item) return html``;

    const i = this.item;
    const handle = i.author.startsWith("@") ? i.author : `@${i.author}`;
    const displayName = i.displayName || handle;
    const initial = (displayName[0] ?? "?").toUpperCase();
    const postAge = compactRelativeTime(i.createdAt);
    const mediaLabels = countedMediaLabels(i);

    return html`
      <div class="card">
        <div class="author-row">
          ${
            i.avatarUrl
              ? html`<img src=${i.avatarUrl} alt="" class="avatar" />`
              : html`<div class="avatar-placeholder">${initial}</div>`
          }
          <div class="author-info">
            <div class="display-name">${displayName}</div>
            <div class="handle">
              ${handle}${
                postAge
                  ? html`<time class="post-time" datetime=${i.createdAt}>${postAge}</time>`
                  : ""
              }
            </div>
          </div>
          <div class="author-actions">
            ${mediaLabels.map((label) => html`<span class="content-badge">${label}</span>`)}
            ${
              i.postUrl
                ? html`
                    <a
                      href=${i.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="bluesky-btn"
                      title="Open in Bluesky"
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        const root = getRootStore();
                        const requestId = root?.feedStore.currentRequestId;
                        const feedName = requestId
                          ? root.feedStore.feedList.find((feed) => feed.requestId === requestId)
                              ?.feedName
                          : undefined;
                        root?.services.analyticsService.capture("postOpenedInBluesky", {
                          item_uri: i.atUri,
                          feed_name: feedName ?? "unknown",
                          final_position: i.finalPosition,
                        });
                      }}
                    >
                      <wa-icon name="bluesky" library="app"></wa-icon>
                    </a>
                  `
                : ""
            }
          </div>
        </div>

        <p class="post-content">${i.content}</p>

        <div class="chart-section">
          <rank-scores-chart
            .item=${this.item}
            .algorithmId=${this.algorithmId}
            .engagingInfluence=${this.engagingInfluence}
            .constructiveInfluence=${this.constructiveInfluence}
          ></rank-scores-chart>
        </div>
      </div>
    `;
  }

  private _loggedAtUri: string | null = null;

  updated(_changedProperties: Map<string, unknown>) {
    super.updated(_changedProperties);
    if (this.item && this.item.atUri !== this._loggedAtUri) {
      this._loggedAtUri = this.item.atUri;
      console.groupCollapsed(`[feed-item-card] ${this.item.author} — generators & model scores`);
      console.log("atUri:", this.item.atUri);
      console.log("generators:", JSON.stringify(this.item.generators));
      console.log("modelScores:", JSON.stringify(this.item.modelScores));
      console.groupEnd();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feed-item-card": FeedItemCard;
  }
}

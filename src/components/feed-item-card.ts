import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { FeedItemView } from "../models/feed-debug-snapshot";
import type { AlgorithmId } from "../constants/algorithms";
import { getRootStore } from "../main";
import { compactRelativeTime } from "../utils/relative-time";
import { countedMediaLabels } from "../utils/media-labels";
import "./rank-scores-chart";

@customElement("feed-item-card")
export class FeedItemCard extends MobxLitElement {
  @property({ type: Object }) item: FeedItemView | null = null;
  @property({ attribute: false }) algorithmId: AlgorithmId | null = null;
  @property({ type: Number }) engagingInfluence = 0.5;
  @property({ type: Number }) constructiveInfluence = 0.5;

  @state() private failedImageUrls = new Set<string>();

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
    .post-body-container {
      container: post-card / inline-size;
    }
    .post-body {
      display: grid;
      gap: 1rem;
      margin-top: 0.75rem;
      min-width: 0;
    }
    .media-gallery {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 0.5rem;
      width: 100%;
      min-width: 0;
      aspect-ratio: 4 / 3;
      max-height: 320px;
    }
    .media-gallery.single-image {
      grid-template-columns: minmax(0, 1fr);
    }
    .media-gallery.three-images > :first-child {
      grid-row: span 2;
    }
    .media-tile {
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      border-radius: 0.5rem;
      background: var(--bluesky-bg);
      color: var(--bluesky-text-secondary);
      text-decoration: none;
    }
    a.media-tile:hover {
      background: var(--bluesky-bg-hover);
    }
    .media-tile:focus-visible {
      outline: 2px solid var(--bluesky-brand);
      outline-offset: 2px;
    }
    .post-image {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
      object-fit: contain;
    }
    .image-unavailable {
      padding: 0.75rem;
      font-size: 0.8125rem;
      text-align: center;
    }
    .post-content {
      min-width: 0;
      font-size: 0.9375rem;
      line-height: 1.45;
      color: var(--bluesky-text);
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    @container post-card (min-width: 640px) {
      .post-body.has-images-and-text {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
      }
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
    const mediaLabels = countedMediaLabels(i).filter((label) => !/^\d+ images?$/i.test(label));
    const hasText = i.content.trim().length > 0;

    return html`
      <div class="card">
        <div class="author-row">
          ${
            i.avatarUrl
              ? html`<img src=${i.avatarUrl} alt="" class="avatar" width="40" height="40" />`
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
                      @click=${this.#handleBlueskyClick}
                    >
                      <wa-icon name="bluesky" library="app"></wa-icon>
                    </a>
                  `
                : ""
            }
          </div>
        </div>

        ${
          i.imageUrls.length > 0 || hasText
            ? html`<div class="post-body-container">
                <div
                  class="post-body ${i.imageUrls.length > 0 && hasText ? "has-images-and-text" : ""}"
                >
                  ${this.#renderImages(i, displayName)}
                  ${hasText ? html`<p class="post-content">${i.content}</p>` : nothing}
                </div>
              </div>`
            : nothing
        }

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

  protected willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("item")) this.failedImageUrls = new Set();
  }

  #renderImages(item: FeedItemView, displayName: string) {
    if (item.imageUrls.length === 0) return nothing;

    return html`<div
      class="media-gallery ${item.imageUrls.length === 1 ? "single-image" : ""} ${
        item.imageUrls.length === 3 ? "three-images" : ""
      }"
    >
      ${item.imageUrls.map((url, index) => {
        const description = `Image ${String(index + 1)} of ${String(item.imageUrls.length)} from ${displayName}'s post`;
        const content = this.failedImageUrls.has(url)
          ? html`<span
              class="image-unavailable"
              role="img"
              aria-label=${`${description}: image unavailable`}
              >Image unavailable</span
            >`
          : html`<img
              class="post-image"
              src=${url}
              alt=${description}
              width="640"
              height="480"
              loading="lazy"
              decoding="async"
              @error=${() => {
                this.failedImageUrls = new Set([...this.failedImageUrls, url]);
              }}
            />`;

        return item.postUrl
          ? html`<a
              class="media-tile"
              href=${item.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label=${`Open post by ${displayName} in Bluesky (image ${String(index + 1)} of ${String(item.imageUrls.length)})`}
              @click=${this.#handleBlueskyClick}
              >${content}</a
            >`
          : html`<div class="media-tile">${content}</div>`;
      })}
    </div>`;
  }

  #handleBlueskyClick = (event: Event): void => {
    event.stopPropagation();
    const item = this.item;
    if (!item) return;

    const root = getRootStore();
    const requestId = root?.feedStore.currentRequestId;
    const feedName = requestId
      ? root.feedStore.feedList.find((feed) => feed.requestId === requestId)?.feedName
      : undefined;
    root?.services.analyticsService.capture("postOpenedInBluesky", {
      item_uri: item.atUri,
      feed_name: feedName ?? "unknown",
      final_position: item.finalPosition,
    });
  };

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

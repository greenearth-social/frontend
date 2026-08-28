import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { FeedItemView, FilteringCounts } from "../models/feed-debug-snapshot";
import { countedMediaLabels } from "../utils/media-labels";
import { generatorPresentation } from "./generator-presentation";
import "@awesome.me/webawesome/dist/components/icon/icon.js";

export type RankMovement =
  | { kind: "new"; delta: null; icon: "seedling"; label: "New post" }
  | {
      kind: "up" | "down" | "unchanged";
      delta: number;
      icon: "chevron-up" | "chevrons-up" | "chevron-down" | "chevrons-down" | "minus";
      label: string;
    };

export function rankMovement(
  atUri: string,
  before: FeedItemView[],
  after: FeedItemView[],
): RankMovement {
  const oldIndex = before.findIndex((item) => item.atUri === atUri);
  if (oldIndex < 0) return { kind: "new", delta: null, icon: "seedling", label: "New post" };
  const newIndex = after.findIndex((item) => item.atUri === atUri);
  const delta = oldIndex - newIndex;
  if (delta === 0) {
    return { kind: "unchanged", delta, icon: "minus", label: "Rank unchanged" };
  }
  if (delta > 0) {
    return {
      kind: "up",
      delta,
      icon: delta >= 3 ? "chevrons-up" : "chevron-up",
      label: `Moved up ${String(delta)} ${delta === 1 ? "position" : "positions"}`,
    };
  }
  const absoluteDelta = Math.abs(delta);
  return {
    kind: "down",
    delta,
    icon: absoluteDelta >= 3 ? "chevrons-down" : "chevron-down",
    label: `Moved down ${String(absoluteDelta)} ${absoluteDelta === 1 ? "position" : "positions"}`,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export const PREVIEW_PAGE_SIZE = 20;

export const PREVIEW_ANIMATION_TIMINGS = {
  fadeOut: 450,
  fadeOutStagger: 225,
  removeSpace: 400,
  rerank: 1550,
  insertSpace: 400,
  fadeIn: 450,
  fadeInStagger: 225,
  reducedMotion: 160,
} as const;

export function deletionCascadeDelay(index: number, count: number): number {
  if (count <= 1 || index <= 0) return 0;
  const boundedIndex = Math.min(index, count - 1);
  return boundedIndex * PREVIEW_ANIMATION_TIMINGS.fadeOutStagger;
}

export function revealCascadeDelay(index: number, count: number): number {
  if (count <= 1 || index <= 0) return 0;
  const boundedIndex = Math.min(index, count - 1);
  return boundedIndex * PREVIEW_ANIMATION_TIMINGS.fadeInStagger;
}

export interface PreviewPageTransition {
  removed: string[];
  leavingPage: string[];
  enteringPage: string[];
  added: string[];
}

export function previewPageTransition(
  before: FeedItemView[],
  after: FeedItemView[],
  page = 1,
): PreviewPageTransition {
  const pageStart = (Math.max(1, page) - 1) * PREVIEW_PAGE_SIZE;
  const pageEnd = pageStart + PREVIEW_PAGE_SIZE;
  const beforePage = before.slice(pageStart, pageEnd);
  const afterPage = after.slice(pageStart, pageEnd);
  const beforeUris = new Set(before.map((item) => item.atUri));
  const afterUris = new Set(after.map((item) => item.atUri));
  const beforePageUris = new Set(beforePage.map((item) => item.atUri));
  const afterPageUris = new Set(afterPage.map((item) => item.atUri));
  return {
    removed: beforePage.filter((item) => !afterUris.has(item.atUri)).map((item) => item.atUri),
    leavingPage: beforePage
      .filter((item) => afterUris.has(item.atUri) && !afterPageUris.has(item.atUri))
      .map((item) => item.atUri),
    enteringPage: afterPage
      .filter((item) => beforeUris.has(item.atUri) && !beforePageUris.has(item.atUri))
      .map((item) => item.atUri),
    added: afterPage.filter((item) => !beforeUris.has(item.atUri)).map((item) => item.atUri),
  };
}

@customElement("settings-feed-preview")
export class SettingsFeedPreview extends LitElement {
  @property({ attribute: false }) items: FeedItemView[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) error = "";
  @property({ attribute: false }) filteringCounts: FilteringCounts | null = null;
  @state() private renderedItems: FeedItemView[] = [];
  @state() private comparisonItems: FeedItemView[] = [];
  @state() private currentPage = 1;
  @state() private phase:
    "idle" | "fade-out" | "compact" | "rerank" | "insert-space" | "fade-in" = "idle";
  @state() private removedUris = new Set<string>();
  @state() private newUris = new Set<string>();
  private isAnimating = false;
  private currentSlate: FeedItemView[] = [];

  static styles = css`
    :host {
      display: block;
      min-height: 100%;
      color: var(--text-primary, #e7e9ea);
    }

    .status {
      display: grid;
      min-height: 15rem;
      place-items: center;
      padding: 2rem;
      color: var(--text-secondary, #71767b);
      text-align: center;
    }

    .feed {
      display: grid;
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .slate-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem 0.75rem;
      padding: 0.75rem 0.75rem 0;
      color: var(--text-secondary, #8b98a5);
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
    }

    .filter-summary {
      opacity: 0.86;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.25rem 0.75rem 1rem;
      color: var(--text-secondary, #8b98a5);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }

    .page-button {
      display: inline-grid;
      min-width: 2.75rem;
      min-height: 2.75rem;
      place-items: center;
      padding: 0;
      border: 1px solid var(--bluesky-border, #2f3336);
      border-radius: 999px;
      background: color-mix(in srgb, var(--surface, #16181c) 88%, transparent);
      color: var(--text-primary, #e7e9ea);
      cursor: pointer;
    }

    .page-button:hover:not(:disabled),
    .page-button:focus-visible {
      border-color: var(--bluesky-brand, #1083fe);
      background: color-mix(in srgb, var(--bluesky-brand, #1083fe) 12%, transparent);
      outline: none;
    }

    .page-button:disabled {
      cursor: default;
      opacity: 0.4;
    }

    .page-button wa-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }

    .card {
      box-sizing: border-box;
      overflow: hidden;
      min-height: 4.375rem;
      max-height: 8rem;
      padding: 0.75rem;
      border: 2px solid var(--source-border);
      border-radius: 0.875rem;
      background: var(--surface, #16181c);
      opacity: 1;
      transition:
        min-height 400ms ease,
        max-height 400ms ease,
        padding 400ms ease,
        opacity 450ms ease,
        margin 400ms ease;
      will-change: transform, opacity;
    }

    .metadata {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 0.5rem;
      line-height: 1.25rem;
    }

    .author {
      overflow: hidden;
      flex: 1;
      color: var(--source-color);
      font-size: 0.875rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .content-row {
      display: flex;
      overflow: hidden;
      min-height: 1.375rem;
      max-height: 1.375rem;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.25rem;
      opacity: 1;
      transition:
        min-height 400ms ease,
        max-height 400ms ease,
        margin 400ms ease,
        opacity 300ms ease;
    }

    .source-pill,
    .content-pill {
      overflow: hidden;
      min-width: 0;
      padding: 0.125rem 0.45rem;
      border: 1px solid var(--source-border);
      border-radius: 999px;
      background: color-mix(in srgb, var(--source-color) 12%, transparent);
      color: var(--source-color);
      font-size: 0.625rem;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-pill {
      flex: none;
    }

    .movement {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 0.125rem;
      color: var(--text-secondary, #8b98a5);
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
      font-weight: 650;
    }

    .movement wa-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }

    .movement.up {
      color: var(--bluesky-brand, #1083fe);
    }

    .movement.down {
      color: var(--bluesky-danger, #f4212e);
    }

    .movement.new {
      color: var(--bluesky-repost, #00ba7c);
    }

    .movement.unchanged {
      color: var(--text-secondary, #8b98a5);
    }

    .snippet {
      display: -webkit-box;
      overflow: hidden;
      max-height: 2.5rem;
      margin-top: 0.45rem;
      color: var(--text-primary, #e7e9ea);
      font-size: 0.8125rem;
      line-height: 1.25rem;
      opacity: 1;
      transition:
        max-height 400ms ease,
        margin 400ms ease,
        opacity 300ms ease;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .fade-out .card.removed {
      opacity: 0;
      transition-delay: var(--removal-delay, 0ms);
    }

    .compact .card.removed {
      min-height: 0;
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      border-width: 0;
      opacity: 0;
    }

    .insert-space .card.new {
      animation: open-card 400ms ease both;
    }

    .fade-in .card.new {
      animation: reveal-card 450ms ease both;
      animation-delay: var(--reveal-delay, 0ms);
    }

    @keyframes open-card {
      from {
        min-height: 0;
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        border-width: 0;
        opacity: 0;
      }
      to {
        opacity: 0;
      }
    }

    @keyframes reveal-card {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .card,
      .snippet {
        transition-duration: 80ms;
      }
    }
  `;

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("items") && !this.isAnimating) {
      this.currentSlate = [...this.items];
      this.currentPage = Math.min(this.currentPage, this.totalPagesFor(this.currentSlate));
      this.renderedItems = this.pageItems(this.currentSlate, this.currentPage);
      if (this.currentSlate.length === 0) {
        // Settings clears the slate while switching feeds. Drop the previous
        // feed's comparison origin so the incoming baseline settles to dashes.
        this.comparisonItems = [];
      } else if (this.comparisonItems.length === 0) {
        this.comparisonItems = this.currentSlate;
      }
    }
  }

  async animateTo(nextItems: FeedItemView[], fromItems?: FeedItemView[]): Promise<void> {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const current = [...(fromItems ?? this.currentSlate)];
    const next = [...nextItems];
    const animationPage = Math.min(this.currentPage, this.totalPagesFor(next));
    const currentVisible = this.pageItems(current, animationPage);
    const nextVisible = this.pageItems(next, animationPage);
    try {
      this.currentPage = animationPage;
      if (fromItems) {
        this.currentSlate = current;
        this.comparisonItems = current;
        this.renderedItems = currentVisible;
        this.removedUris = new Set();
        this.newUris = new Set();
        this.phase = "idle";
        await this.updateComplete;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        const animation = this.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
          duration: PREVIEW_ANIMATION_TIMINGS.reducedMotion,
          easing: "ease-out",
        });
        this.comparisonItems = current;
        this.currentSlate = next;
        this.renderedItems = nextVisible;
        await animation.finished.catch(() => undefined);
        return;
      }

      this.comparisonItems = current;
      // Only the visible page participates in the animation. The complete
      // `next` slate is still adopted below so pagination exposes every
      // off-page change as soon as the transition finishes.
      const pageTransition = previewPageTransition(current, next, animationPage);
      this.removedUris = new Set([...pageTransition.removed, ...pageTransition.leavingPage]);
      this.phase = "fade-out";
      await this.updateComplete;
      await delay(
        PREVIEW_ANIMATION_TIMINGS.fadeOut +
          deletionCascadeDelay(this.removedUris.size - 1, this.removedUris.size),
      );

      this.phase = "compact";
      await this.updateComplete;
      await delay(PREVIEW_ANIMATION_TIMINGS.removeSpace);

      const currentVisibleUris = new Set(currentVisible.map((item) => item.atUri));
      const nextVisibleUris = new Set(nextVisible.map((item) => item.atUri));
      const survivingCurrentPage = currentVisible.filter((item) => nextVisibleUris.has(item.atUri));
      const survivingNextPage = nextVisible.filter((item) => currentVisibleUris.has(item.atUri));
      const hasReordering = survivingCurrentPage.some(
        (item, index) => item.atUri !== survivingNextPage[index]?.atUri,
      );
      this.currentSlate = next;
      this.renderedItems = survivingCurrentPage;
      this.removedUris = new Set();
      if (hasReordering) {
        this.phase = "rerank";
        await this.updateComplete;

        const oldElements = [
          ...this.renderRoot.querySelectorAll<HTMLElement>(".feed > [data-uri]"),
        ];
        const oldRects = new Map(
          oldElements.map((element) => [element.dataset.uri ?? "", element.getBoundingClientRect()]),
        );

        this.renderedItems = survivingNextPage;
        await this.updateComplete;
        const animations = [
          ...this.renderRoot.querySelectorAll<HTMLElement>(".feed > [data-uri]"),
        ].map((element) => {
          const oldRect = oldRects.get(element.dataset.uri ?? "");
          const newRect = element.getBoundingClientRect();
          const offset = oldRect ? oldRect.top - newRect.top : 0;
          return element
            .animate([{ transform: `translateY(${String(offset)}px)` }, { transform: "none" }], {
              duration: PREVIEW_ANIMATION_TIMINGS.rerank,
              easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            })
            .finished.catch(() => undefined);
        });
        await Promise.all(animations);
      } else {
        // Deletions and insertions can change the visible page without changing
        // the relative order of its surviving posts. Move directly to the next
        // phase instead of holding on an imperceptible rerank animation.
        this.renderedItems = survivingNextPage;
        await this.updateComplete;
      }

      this.newUris = new Set(
        nextVisible.filter((item) => !currentVisibleUris.has(item.atUri)).map((item) => item.atUri),
      );
      this.renderedItems = nextVisible;
      this.phase = "insert-space";
      await this.updateComplete;
      await delay(PREVIEW_ANIMATION_TIMINGS.insertSpace);

      this.phase = "fade-in";
      await this.updateComplete;
      await delay(
        PREVIEW_ANIMATION_TIMINGS.fadeIn +
          revealCascadeDelay(this.newUris.size - 1, this.newUris.size),
      );
    } finally {
      this.removedUris = new Set();
      this.newUris = new Set();
      this.phase = "idle";
      this.isAnimating = false;
    }
  }

  settleAsOrigin(items: FeedItemView[]): void {
    const settled = [...items];
    this.currentSlate = settled;
    this.comparisonItems = settled;
    this.currentPage = 1;
    this.renderedItems = settled.slice(0, PREVIEW_PAGE_SIZE);
    this.removedUris = new Set();
    this.newUris = new Set();
    this.phase = "idle";
  }

  render() {
    if (this.loading && this.renderedItems.length === 0) {
      return html`<div class="status" role="status">Loading your current feed…</div>`;
    }
    if (this.error && this.renderedItems.length === 0) {
      return html`<div class="status" role="alert">${this.error}</div>`;
    }
    if (this.renderedItems.length === 0) {
      return html`<div class="status">No posts are available for this feed yet.</div>`;
    }
    const counts = this.filteringCounts ?? {
      storedItemCount: this.currentSlate.length,
      displayedItemCount: this.currentSlate.length,
      publiclyFilteredCount: 0,
      unavailableCount: 0,
    };
    const totalPages = this.totalPagesFor(this.currentSlate);
    const paginationDisabled = this.loading || this.phase !== "idle";
    return html`
      <div class="slate-summary" role="status">
        <span>${counts.displayedItemCount} available of ${counts.storedItemCount} ranked</span>
        ${
          counts.publiclyFilteredCount || counts.unavailableCount
            ? html`<span class="filter-summary"
                >${counts.publiclyFilteredCount} filtered · ${counts.unavailableCount}
                unavailable</span
              >`
            : nothing
        }
      </div>
      <div class="feed ${this.phase}" aria-live="polite">
        ${repeat(
          this.renderedItems,
          (item) => item.atUri,
          (item) => this.renderCard(item),
        )}
      </div>
      ${
        totalPages > 1
          ? html`<nav class="pagination" aria-label="Feed preview pagination">
              <button
                class="page-button"
                type="button"
                aria-label="Previous preview page"
                ?disabled=${paginationDisabled || this.currentPage === 1}
                @click=${() => {
                  this.setPage(this.currentPage - 1);
                }}
              >
                <wa-icon library="app" name="chevron-left"></wa-icon>
              </button>
              <span>Page ${this.currentPage} of ${totalPages}</span>
              <button
                class="page-button"
                type="button"
                aria-label="Next preview page"
                ?disabled=${paginationDisabled || this.currentPage === totalPages}
                @click=${() => {
                  this.setPage(this.currentPage + 1);
                }}
              >
                <wa-icon library="app" name="chevron-right"></wa-icon>
              </button>
            </nav>`
          : nothing
      }
    `;
  }

  private pageItems(items: FeedItemView[], page: number): FeedItemView[] {
    const start = (page - 1) * PREVIEW_PAGE_SIZE;
    return items.slice(start, start + PREVIEW_PAGE_SIZE);
  }

  private totalPagesFor(items: FeedItemView[]): number {
    return Math.max(1, Math.ceil(items.length / PREVIEW_PAGE_SIZE));
  }

  private setPage(page: number): void {
    if (this.loading || this.phase !== "idle") return;
    const nextPage = Math.min(Math.max(1, page), this.totalPagesFor(this.currentSlate));
    if (nextPage === this.currentPage) return;
    this.currentPage = nextPage;
    this.renderedItems = this.pageItems(this.currentSlate, nextPage);
  }

  private renderCard(item: FeedItemView) {
    const source = generatorPresentation(item.generators[0]?.name);
    const contentLabels = countedMediaLabels(item);
    const movement = rankMovement(item.atUri, this.comparisonItems, this.currentSlate);
    const delta = movement.delta === null ? "" : String(Math.abs(movement.delta));
    const movementText =
      movement.kind === "new" ? "New" : movement.kind === "unchanged" ? "" : delta;
    const removedItems = this.renderedItems.filter((candidate) =>
      this.removedUris.has(candidate.atUri),
    );
    const removalIndex = removedItems.findIndex((candidate) => candidate.atUri === item.atUri);
    const removalDelay = deletionCascadeDelay(removalIndex, removedItems.length);
    const newItems = this.renderedItems.filter((candidate) => this.newUris.has(candidate.atUri));
    const revealIndex = newItems.findIndex((candidate) => candidate.atUri === item.atUri);
    const revealDelay = revealCascadeDelay(revealIndex, newItems.length);
    return html`
      <article
        class="card ${this.removedUris.has(item.atUri) ? "removed" : ""} ${this.newUris.has(item.atUri) ? "new" : ""}"
        data-uri=${item.atUri}
        style="--source-border:${source.border};--source-color:${source.color};--removal-delay:${String(removalDelay)}ms;--reveal-delay:${String(revealDelay)}ms"
      >
        <div class="metadata">
          <span class="author">${item.displayName || item.author}</span>
          <span class="source-pill candidate-pill">${source.label}</span>
          <span
            class="movement ${movement.kind}"
            aria-label=${movement.label}
            title=${movement.label}
          >
            <wa-icon library="app" name=${movement.icon}></wa-icon>${movementText || nothing}
          </span>
        </div>
        <div class="snippet">${item.content || item.mediaLabels.join(", ") || "Post"}</div>
        ${
          contentLabels.length > 0
            ? html`<div class="content-row">
                ${contentLabels.map(
                  (label) => html`<span class="content-pill">${label}</span>`,
                )}
              </div>`
            : nothing
        }
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-feed-preview": SettingsFeedPreview;
  }
}

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("pagination-control")
export class PaginationControl extends LitElement {
  @property({ type: Number }) currentPage = 1;
  @property({ type: Number }) totalPages = 1;
  @property({ type: Number }) totalItems = 0;
  @property({ type: Number }) itemsPerPage = 3;
  @property({ type: Array }) perPageOptions: number[] = [3, 5, 10, 20];

  static styles = css`
    :host {
      display: block;
      padding: 1.5rem 0;
    }
    .pagination-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .pagination-buttons {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      padding: 0 0.5rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      background: var(--bluesky-bg-card);
      color: var(--bluesky-text);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .page-btn:hover:not(:disabled) {
      background: var(--bluesky-bg-hover);
      border-color: var(--bluesky-text-secondary);
    }
    .page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .page-btn.active {
      background: var(--bluesky-brand);
      border-color: var(--bluesky-brand);
      color: white;
      font-weight: 600;
    }
    .page-btn.nav-btn {
      font-size: 1.1rem;
    }
    .ellipsis {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      color: var(--bluesky-text-secondary);
      font-size: 1.1rem;
      letter-spacing: 0.25rem;
    }
    .results-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 400px;
      padding: 0 1rem;
    }
    .results-text {
      font-size: 0.9375rem;
      color: var(--bluesky-text-secondary);
      padding-left: 0.5rem;
    }
    .per-page-select {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-right: 0.5rem;
    }
    .per-page-select select {
      padding: 0.5rem 2rem 0.5rem 0.75rem;
      border: 1px solid var(--bluesky-border);
      border-radius: 0.5rem;
      background: var(--bluesky-bg-card);
      color: var(--bluesky-text);
      font-size: 0.9375rem;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371767b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
    }
    .per-page-select select:focus {
      outline: none;
      border-color: var(--bluesky-brand);
    }
  `;

  render() {
    if (this.totalPages <= 1) return html``;

    const pages = this.#getVisiblePages();
    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

    return html`
      <div class="pagination-container">
        <div class="pagination-buttons">
          <button
            class="page-btn nav-btn"
            ?disabled=${this.currentPage === 1}
            @click=${() => { this.#goToPage(this.currentPage - 1); }}
            aria-label="Previous page"
          >
            ‹
          </button>
          
          ${pages.map((page) =>
            page === "ellipsis"
              ? html`<span class="ellipsis">...</span>`
              : html`
                  <button
                    class="page-btn ${page === this.currentPage ? "active" : ""}"
                    @click=${() => { this.#goToPage(page); }}
                  >
                    ${page}
                  </button>
                `
          )}
          
          <button
            class="page-btn nav-btn"
            ?disabled=${this.currentPage === this.totalPages}
            @click=${() => { this.#goToPage(this.currentPage + 1); }}
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        <div class="results-info">
          <span class="results-text">
            Results: ${startItem} - ${endItem} of ${this.totalItems}
          </span>
          <div class="per-page-select">
            <select
              @change=${(e: Event) => { this.#changePerPage(e); }}
            >
              ${this.perPageOptions.map((option) =>
                html`<option value=${option} ?selected=${option === this.itemsPerPage}>
                  ${option}
                </option>`
              )}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  #getVisiblePages(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (current > 3) {
        pages.push("ellipsis");
      }
      
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (current < total - 2) {
        pages.push("ellipsis");
      }
      
      pages.push(total);
    }

    return pages;
  }

  #goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.dispatchEvent(
        new CustomEvent("page-change", {
          bubbles: true,
          composed: true,
          detail: { page },
        })
      );
    }
  }

  #changePerPage(e: Event) {
    const select = e.target as HTMLSelectElement;
    const newPerPage = parseInt(select.value, 10);
    this.dispatchEvent(
      new CustomEvent("per-page-change", {
        bubbles: true,
        composed: true,
        detail: { perPage: newPerPage },
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pagination-control": PaginationControl;
  }
}

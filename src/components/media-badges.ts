import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("media-badges")
export class MediaBadges extends LitElement {
  @property({ type: Array }) labels: string[] = [];

  static styles = css`
    :host {
      display: inline-flex;
    }
  `;

  render() {
    if (this.labels.length === 0) return html``;

    return html`
      <div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
        ${this.labels.map(
          (label) => html`
            <span style="
              font-size: 0.75rem;
              padding: 0.1875rem 0.5rem;
              border-radius: 9999px;
              background: color-mix(in srgb, var(--theme-orange) 10%, transparent);
              color: var(--theme-orange);
              border: 1px solid color-mix(in srgb, var(--theme-orange) 30%, transparent);
              font-weight: 500;
            ">
              ${label}
            </span>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "media-badges": MediaBadges;
  }
}

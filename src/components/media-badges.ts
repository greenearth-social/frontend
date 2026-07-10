import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("media-badges")
export class MediaBadges extends LitElement {
  @property({ type: Array }) labels: string[] = [];

  render() {
    if (this.labels.length === 0) return html``;

    return html`
      <div class="flex flex-wrap gap-1">
        ${this.labels.map(
          (label) => html`
            <span class="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded border border-gray-200">
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

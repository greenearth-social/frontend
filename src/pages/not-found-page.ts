import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("not-found-page")
export class NotFoundPage extends LitElement {
  render() {
    return html`
      <div class="text-center py-16">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p class="text-gray-500 mb-4">Page not found</p>
        <a href="#/feed" class="text-blue-600 hover:text-blue-800 underline">
          Go to feed
        </a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "not-found-page": NotFoundPage;
  }
}

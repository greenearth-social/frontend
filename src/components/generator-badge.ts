import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { GENERATOR_PRESENTATIONS, generatorPresentation } from "./generator-presentation";

export const GENERATOR_LABELS = Object.fromEntries(
  Object.entries(GENERATOR_PRESENTATIONS).map(([name, value]) => [name, value.label]),
);

@customElement("generator-badge")
export class GeneratorBadge extends LitElement {
  @property({ type: String }) name = "";

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
  `;

  render() {
    const style = generatorPresentation(this.name);

    return html`
      <span
        style="
          background: ${style.background};
          color: ${style.color};
          border: 1px solid ${style.border};
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.1875rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
        "
      >
        ${style.label}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "generator-badge": GeneratorBadge;
  }
}

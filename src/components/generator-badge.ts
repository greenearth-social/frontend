import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

const GENERATOR_COLORS: Record<string, string> = {
  two_tower: "bg-generator-two_tower",
  followed_users: "bg-generator-followed_users",
  popularity: "bg-generator-popularity",
  post_similarity: "bg-generator-post_similarity",
  network_likes: "bg-generator-network_likes",
  random_posts: "bg-generator-random_posts",
};

@customElement("generator-badge")
export class GeneratorBadge extends LitElement {
  @property({ type: String }) name = "";
  @property({ type: Number }) score: number | null = null;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `;

  render() {
    const colorClass = GENERATOR_COLORS[this.name] ?? "bg-gray-400";
    const scoreText = this.score !== null ? ` ${(this.score * 100).toFixed(0)}%` : "";

    return html`
      <span
        class="${colorClass} text-white text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      >
        ${this.name}${scoreText}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "generator-badge": GeneratorBadge;
  }
}

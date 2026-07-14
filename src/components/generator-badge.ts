import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

const GENERATOR_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  two_tower: { bg: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "rgba(56, 189, 248, 0.35)" },
  followed_users: { bg: "rgba(52, 211, 153, 0.12)", color: "#34d399", border: "rgba(52, 211, 153, 0.35)" },
  popularity: { bg: "rgba(244, 114, 182, 0.12)", color: "#f472b6", border: "rgba(244, 114, 182, 0.35)" },
  post_similarity: { bg: "rgba(192, 132, 252, 0.12)", color: "#c084fc", border: "rgba(192, 132, 252, 0.35)" },
  network_likes: { bg: "rgba(249, 24, 128, 0.12)", color: "#f91880", border: "rgba(249, 24, 128, 0.35)" },
  random_posts: { bg: "rgba(113, 118, 123, 0.15)", color: "#71767b", border: "rgba(113, 118, 123, 0.4)" },
};

const DEFAULT_STYLE = { bg: "rgba(113, 118, 123, 0.15)", color: "#71767b", border: "rgba(113, 118, 123, 0.4)" };

@customElement("generator-badge")
export class GeneratorBadge extends LitElement {
  @property({ type: String }) name = "";
  @property({ type: Number }) score: number | null = null;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
  `;

  render() {
    const style = GENERATOR_STYLES[this.name] ?? DEFAULT_STYLE;
    const clampedScore = this.score !== null ? Math.min(Math.max(this.score, 0), 1) : null;
    const scoreText = clampedScore !== null ? ` ${(clampedScore * 100).toFixed(0)}%` : " --";

    return html`
      <span
        style="
          background: ${style.bg};
          color: ${style.color};
          border: 1px solid ${style.border};
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.1875rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
        "
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

import { css } from "lit";

/** A pane of glass over the wallpaper: cards, nav groups, the feedback form. */
export const glassBox = css`
  .glass-box {
    border: 0;
    border-radius: var(--theme-radius-box);
    background: var(--theme-glass);
    backdrop-filter: var(--theme-glass-blur);
    box-shadow: var(--theme-box-glow);
  }
`;

/** Page titles: a small glass bubble holding the logo and gradient lettering. */
export const titleBubble = css`
  .title-bubble {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-sizing: border-box;
    height: var(--theme-control-height);
    padding: 0 0.75rem;
    border-radius: var(--theme-radius-pill);
    background: var(--theme-title-bubble-bg);
    box-shadow: var(--theme-title-bubble-shadow);
  }
  .title-logo {
    width: 1.6em;
    height: 1.6em;
    margin-block: -0.2em;
    flex: none;
  }
  .title-text {
    background: var(--theme-title-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
`;

import { MobxLitElement } from "@adobe/lit-mobx";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("settings-page")
export class SettingsPage extends MobxLitElement {
  @property({ type: Object }) onOpenMenu: (() => void) | undefined;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`
      <div class="sticky top-0 z-30" style="background: rgba(21, 32, 43, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--bluesky-border);">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.5rem;">
          <button
            class="hamburger-btn"
            @click=${() => this.onOpenMenu?.()}
            aria-label="Open navigation"
            type="button"
            style="display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9999px; border: none; background: transparent; color: var(--bluesky-text); cursor: pointer; flex-shrink: 0;"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h1 class="text-xl font-bold" style="color: var(--bluesky-text); margin: 0; flex: 1;">Settings</h1>
        </div>
        <style>
           @media (max-width: 1023px) {
            .hamburger-btn { display: flex !important; }
          }
        </style>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-page": SettingsPage;
  }
}

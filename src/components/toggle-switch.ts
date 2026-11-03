import { html, type TemplateResult } from "lit";

// A sliding on/off switch on top of a native checkbox, so forms, keyboard and
// tests see an ordinary input. Styled by the settings page (.ge-switch*).
export interface ToggleSwitchOptions {
  inputClass: string;
  ariaLabel: string;
  checked: boolean;
  disabled: boolean;
  text: string;
  onChange: (checked: boolean) => void;
}

export function renderToggleSwitch(options: ToggleSwitchOptions): TemplateResult {
  return html`
    <label class="ge-switch">
      <input
        class="ge-switch-input ${options.inputClass}"
        type="checkbox"
        role="switch"
        aria-label=${options.ariaLabel}
        .checked=${options.checked}
        ?disabled=${options.disabled}
        @change=${(event: Event) => {
          if (options.disabled) return;
          options.onChange((event.target as HTMLInputElement).checked);
        }}
      />
      <span class="ge-switch-track" aria-hidden="true"></span>
      <span class="ge-switch-text">${options.text}</span>
    </label>
  `;
}

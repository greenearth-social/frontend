import { describe, expect, it, vi } from "vitest";
import { DiscreteSlider } from "../components/discrete-slider";

function touchEvent(type: string, clientX: number): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX }],
  });
  return event as TouchEvent;
}

describe("DiscreteSlider icon states", () => {
  it("grays inactive image icons and restores the selected icon color", () => {
    const styles = DiscreteSlider.styles.cssText;

    expect(styles).toMatch(/\.step-icon-image\s*\{[^}]*grayscale\(100%\)/s);
    expect(styles).toMatch(
      /\.step-btn\.active \.step-icon-image\s*\{[^}]*grayscale\(0%\)/s,
    );
    expect(styles).toMatch(/\.thumb\s*\{[^}]*height: 3px/s);
    expect(styles).toMatch(
      /\.thumb\s*\{[^}]*background: var\(--bluesky-brand\)/s,
    );
    expect(styles).toMatch(/\.thumb\s*\{[^}]*rgba\(16, 131, 254, 0\.55\)/s);
    expect(styles).toMatch(/@media \(max-width: 600px\)[\s\S]*width: 24px/);
    expect(styles).toMatch(/\.slider-wrapper\s*\{[^}]*overflow: hidden/s);
    expect(styles).not.toContain("overflow-x: auto");
    expect(styles).toMatch(/\.step-btn\s*\{[^}]*min-width: 0/s);
  });

  it("puts endpoint labels below the slider and previews every option above it", async () => {
    const element = document.createElement("discrete-slider");
    element.options = ["6h", "12h", "24h", "48h", "72h", "7d"];
    document.body.appendChild(element);
    await element.updateComplete;

    const labels = Array.from(element.shadowRoot?.querySelectorAll(".label") ?? []);
    expect(labels.map((label) => label.textContent.trim())).toEqual([
      "6h",
      "",
      "",
      "",
      "",
      "7d",
    ]);

    element.shadowRoot?.querySelectorAll<HTMLElement>(".step-btn")[2]
      ?.dispatchEvent(new MouseEvent("mouseenter"));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll(".step-value")[2]?.textContent).toContain("24h");

    element.shadowRoot?.querySelectorAll<HTMLElement>(".step-btn")[0]
      ?.dispatchEvent(new MouseEvent("mouseenter"));
    await element.updateComplete;
    expect(element.shadowRoot?.querySelectorAll(".step-value")[0]?.textContent).toContain("6h");

    const wrapper = element.shadowRoot?.querySelector(".slider-wrapper");
    const values = element.shadowRoot?.querySelector(".step-values");
    const endpointLabels = element.shadowRoot?.querySelector(".labels-track");
    expect(
      values && wrapper
        ? Boolean(values.compareDocumentPosition(wrapper) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false,
    ).toBe(true);
    expect(
      wrapper && endpointLabels
        ? Boolean(
            wrapper.compareDocumentPosition(endpointLabels)
              & Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : false,
    ).toBe(true);
    element.remove();
  });

  it("supports dragging and mobile tap selection", async () => {
    const element = document.createElement("discrete-slider");
    element.options = ["6h", "12h", "24h", "48h", "72h", "7d"];
    const onChange = vi.fn();
    element.addEventListener("slider-change", onChange);
    document.body.appendChild(element);
    await element.updateComplete;

    const track = element.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    if (!track) throw new Error("slider track not rendered");
    track.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;

    track.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 10 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 350 }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 350 }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { value: 3 } }),
    );

    track.dispatchEvent(touchEvent("touchstart", 550));
    window.dispatchEvent(touchEvent("touchend", 550));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { value: 5 } }),
    );
    element.remove();
  });

  it("previews a mobile drag without changing the selection", async () => {
    const element = document.createElement("discrete-slider");
    element.options = ["6h", "12h", "24h", "48h", "72h", "7d"];
    element.value = 0;
    const onChange = vi.fn();
    element.addEventListener("slider-change", onChange);
    document.body.appendChild(element);
    await element.updateComplete;

    const track = element.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    if (!track) throw new Error("slider track not rendered");
    track.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;

    track.dispatchEvent(touchEvent("touchstart", 50));
    window.dispatchEvent(touchEvent("touchmove", 250));
    await element.updateComplete;

    expect(element.shadowRoot?.querySelectorAll(".step-value")[2]?.textContent).toContain(
      "24h",
    );
    window.dispatchEvent(touchEvent("touchend", 250));
    expect(onChange).not.toHaveBeenCalled();
    expect(element.value).toBe(0);
    element.remove();
  });
});

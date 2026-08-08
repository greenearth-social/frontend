import { describe, expect, it, vi } from "vitest";
import {
  IconRangeSlider,
  iconIndexForValue,
} from "../components/icon-range-slider";

describe("IconRangeSlider", () => {
  it("exposes themeable track, fill, and tick colors", () => {
    const styles = IconRangeSlider.styles.toString();
    expect(styles).toContain("var(--icon-track-color)");
    expect(styles).toContain("var(--icon-fill-color)");
    expect(styles).toContain("var(--icon-tick-color)");
  });

  it("divides continuous controls into five icon buckets and includes the maximum", () => {
    expect(iconIndexForValue(0, 0, 1, 5)).toBe(0);
    expect(iconIndexForValue(0.199, 0, 1, 5)).toBe(0);
    expect(iconIndexForValue(0.2, 0, 1, 5)).toBe(1);
    expect(iconIndexForValue(0.8, 0, 1, 5)).toBe(4);
    expect(iconIndexForValue(1, 0, 1, 5)).toBe(4);
  });

  it("uses the matching thumb artwork for six discrete Time Window values", async () => {
    const element = document.createElement("icon-range-slider");
    element.min = 0;
    element.max = 5;
    element.step = 1;
    element.value = 3;
    element.icons = ["0.png", "1.png", "2.png", "3.png", "4.png", "5.png"];
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".icon-thumb img")?.getAttribute("src")).toBe(
      "3.png",
    );
  });

  it("exposes vertical orientation and accessible range text", async () => {
    const element = new IconRangeSlider();
    element.orientation = "vertical";
    element.min = 0;
    element.max = 0.6;
    element.value = 0.45;
    element.valueText = "Balanced";
    document.body.appendChild(element);
    await element.updateComplete;

    const input = element.shadowRoot?.querySelector("input");
    expect(input?.getAttribute("aria-orientation")).toBe("vertical");
    expect(input?.getAttribute("aria-valuetext")).toBe("Balanced");
  });

  it("can hide a visual value while retaining the accessible range value", async () => {
    const element = new IconRangeSlider();
    element.value = 0.45;
    element.valueText = "Balanced";
    element.showValue = false;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".value")).toBeNull();
    expect(
      element.shadowRoot?.querySelector("input")?.getAttribute("aria-valuetext"),
    ).toBe("Balanced");
  });

  it("shows a constrained maximum on a full-scale source track", async () => {
    const element = new IconRangeSlider();
    element.min = 0;
    element.max = 0.8;
    element.scaleMin = 0;
    element.scaleMax = 1;
    element.value = 0.3;
    document.body.appendChild(element);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector(".range-shell")?.getAttribute("style")).toContain(
      "--interactive-percent: 80%",
    );
    expect(element.shadowRoot?.querySelector(".icon-thumb")?.getAttribute("style")).toContain(
      "left: 30%",
    );
    expect(element.shadowRoot?.querySelector("input")?.getAttribute("aria-valuemax")).toBe(
      "0.8",
    );
  });

  it("commits the last arbitrary preview value after a parent rerender", async () => {
    const element = new IconRangeSlider();
    element.min = 0.2;
    element.max = 1;
    element.step = 0.01;
    element.value = 0.4;
    document.body.appendChild(element);
    await element.updateComplete;
    const committed = vi.fn();
    element.addEventListener("slider-change", committed);
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Range input did not render");

    input.value = "0.53";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    element.value = 0.4;
    await element.updateComplete;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { value: 0.53 } }),
    );
  });

  it("commits the last preview on pointer release when change is omitted", async () => {
    const element = new IconRangeSlider();
    element.min = 0;
    element.max = 0.6;
    element.step = 0.01;
    element.value = 0.45;
    document.body.appendChild(element);
    await element.updateComplete;
    const committed = vi.fn();
    element.addEventListener("slider-change", committed);
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Range input did not render");

    input.value = "0.37";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await Promise.resolve();

    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { value: 0.37 } }),
    );
  });

  it("does not double commit when change follows pointer release", async () => {
    const element = new IconRangeSlider();
    element.value = 0.4;
    document.body.appendChild(element);
    await element.updateComplete;
    const committed = vi.fn();
    element.addEventListener("slider-change", committed);
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Range input did not render");

    input.value = "0.53";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { value: 0.53 } }),
    );
  });
});

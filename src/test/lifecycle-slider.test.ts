import { describe, expect, it, vi } from "vitest";
import "../components/lifecycle-slider";

describe("LifecycleSlider", () => {
  it("renders five icons with labels only for the selected stage", async () => {
    const el = document.createElement("lifecycle-slider");
    el.stageLabels = [
      ["F:0.70", "E:0.30"],
      ["F:0.50"],
      ["F:0.35"],
      ["F:0.25"],
      ["F:0.20"],
    ];
    document.body.appendChild(el);

    await el.updateComplete;

    expect(el.shadowRoot?.querySelectorAll(".stage-btn")).toHaveLength(5);
    expect(el.shadowRoot?.querySelectorAll(".stage-value")).toHaveLength(5);
    expect(el.shadowRoot?.querySelector(".stage-value")?.textContent).toContain("F:0.70");
    expect(el.shadowRoot?.querySelector(".stage-value")?.textContent).toContain("E:0.30");
    expect(
      Array.from(el.shadowRoot?.querySelectorAll(".stage-value") ?? []).slice(1)
        .every((label) => label.textContent.trim() === ""),
    ).toBe(true);
    el.remove();
  });

  it("does not emit changes when disabled", async () => {
    const el = document.createElement("lifecycle-slider");
    el.disabled = true;
    const onChange = vi.fn();
    el.addEventListener("slider-change", onChange);
    document.body.appendChild(el);
    await el.updateComplete;

    const track = el.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    track?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 10 }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100 }));

    expect(onChange).not.toHaveBeenCalled();
    el.remove();
  });
});

import { describe, expect, it, vi } from "vitest";
import "../components/lifecycle-slider";

function touchEvent(type: string, clientX: number): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX }],
  });
  return event as TouchEvent;
}

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

    const values = el.shadowRoot?.querySelector(".stage-values");
    const wrapper = el.shadowRoot?.querySelector(".slider-wrapper");
    const endpointLabels = el.shadowRoot?.querySelector(".labels-track");
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

  it("previews another stage's values on hover", async () => {
    const el = document.createElement("lifecycle-slider");
    el.value = 2;
    el.stageLabels = [
      ["F:1.00", "E:0.00"],
      ["F:0.50", "E:0.50"],
      ["F:0.40", "E:0.60"],
      ["F:0.30", "E:0.70"],
      ["F:0.20", "E:0.80"],
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    el.shadowRoot?.querySelectorAll<HTMLElement>(".stage-btn")[0]
      ?.dispatchEvent(new MouseEvent("mouseenter"));
    await el.updateComplete;

    const values = el.shadowRoot?.querySelectorAll(".stage-value");
    expect(values?.[0]?.textContent).toContain("F:1.00");
    expect(values?.[0]?.textContent).toContain("E:0.00");
    expect(values?.[2]?.textContent.trim()).toBe("");
    el.remove();
  });

  it("selects and exposes a stage when tapped on mobile", async () => {
    const el = document.createElement("lifecycle-slider");
    el.stageLabels = [["One"], ["Two"], ["Three"], ["Four"], ["Five"]];
    const onChange = vi.fn();
    el.addEventListener("slider-change", onChange);
    document.body.appendChild(el);
    await el.updateComplete;

    const track = el.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    if (!track) throw new Error("slider track not rendered");
    track.getBoundingClientRect = () => ({ left: 0, width: 500 }) as DOMRect;

    track.dispatchEvent(touchEvent("touchstart", 350));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelectorAll(".stage-value")[3]?.textContent).toContain("Four");
    window.dispatchEvent(touchEvent("touchend", 350));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { value: 3 } }),
    );
    el.remove();
  });

  it("previews mobile drag weights without selecting, including when disabled", async () => {
    const el = document.createElement("lifecycle-slider");
    el.disabled = true;
    el.value = 0;
    el.stageLabels = [["One"], ["Two"], ["Three"], ["Four"], ["Five"]];
    const onChange = vi.fn();
    el.addEventListener("slider-change", onChange);
    document.body.appendChild(el);
    await el.updateComplete;

    const track = el.shadowRoot?.querySelector<HTMLElement>(".slider-track");
    if (!track) throw new Error("slider track not rendered");
    track.getBoundingClientRect = () => ({ left: 0, width: 500 }) as DOMRect;

    track.dispatchEvent(touchEvent("touchstart", 50));
    window.dispatchEvent(touchEvent("touchmove", 350));
    await el.updateComplete;

    expect(el.shadowRoot?.querySelectorAll(".stage-value")[3]?.textContent).toContain("Four");
    window.dispatchEvent(touchEvent("touchend", 350));
    expect(onChange).not.toHaveBeenCalled();
    expect(el.value).toBe(0);
    el.remove();
  });
});

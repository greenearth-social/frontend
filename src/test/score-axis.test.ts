import { describe, it, expect } from "vitest";
import "../components/score-axis";

describe("ScoreAxis", () => {
  it("renders axis ticks", async () => {
    const el = document.createElement("score-axis");
    el.dots = [];
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("-1");
    expect(el.shadowRoot?.textContent).toContain("0");
    expect(el.shadowRoot?.textContent).toContain("+1");
    document.body.removeChild(el);
  });
});

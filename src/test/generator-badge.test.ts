import { describe, it, expect } from "vitest";
import "../components/generator-badge";

describe("GeneratorBadge", () => {
  it("renders generator name", async () => {
    const el = document.createElement("generator-badge");
    el.name = "two_tower";
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("two_tower");
    document.body.removeChild(el);
  });

  it("does not display a percentage", async () => {
    const el = document.createElement("generator-badge");
    el.name = "followed_users";
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).not.toContain("%");
    document.body.removeChild(el);
  });
});

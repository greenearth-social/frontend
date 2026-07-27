import { describe, it, expect } from "vitest";
import "../components/generator-badge";

describe("GeneratorBadge", () => {
  it("renders the friendly generator label", async () => {
    const el = document.createElement("generator-badge");
    el.name = "two_tower";
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain("Author/Topic");
    document.body.removeChild(el);
  });

  it.each([
    ["followed_users", "Followed"],
    ["popularity", "Popular"],
  ])("maps %s to %s", async (name, label) => {
    const el = document.createElement("generator-badge");
    el.name = name;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain(label);
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

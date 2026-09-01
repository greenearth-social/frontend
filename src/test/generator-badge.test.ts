import { describe, it, expect } from "vitest";
import "../components/generator-badge";
import { GENERATOR_LEGEND, generatorPresentation } from "../components/generator-presentation";

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
    ["followed_users", "Following"],
    ["popularity", "Popular"],
    ["network_likes", "Followed Likes"],
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

  it("defines every friendly legend entry and shares the Author/Topic alias", () => {
    expect(GENERATOR_LEGEND.map(({ label }) => label)).toEqual([
      "Author/Topic",
      "Following",
      "Followed Likes",
      "Popular",
      "Similar",
      "Random",
    ]);
    expect(generatorPresentation("two_tower_empty_history")).toBe(
      generatorPresentation("two_tower"),
    );
  });

  it("uses a unique color for every generator source", () => {
    expect(generatorPresentation("followed_users")).toMatchObject({
      color: "#f472b6",
      border: "rgba(244, 114, 182, 0.8)",
    });
    expect(generatorPresentation("network_likes")).toMatchObject({
      color: "#fbbf24",
      border: "rgba(251, 191, 36, 0.8)",
    });
    expect(generatorPresentation("popularity")).toMatchObject({
      color: "#34d399",
      border: "rgba(52, 211, 153, 0.8)",
    });

    const colors = GENERATOR_LEGEND.map(({ color }) => color);
    expect(new Set(colors)).toHaveLength(colors.length);
  });
});

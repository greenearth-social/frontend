import { describe, expect, it } from "vitest";
import { applyAppIconAttributes } from "../components/icon-library";

describe("app icon attributes", () => {
  it("preserves outline icons while coloring filled icons with the current color", () => {
    const outlineIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    outlineIcon.setAttribute("fill", "none");
    applyAppIconAttributes(outlineIcon);

    expect(outlineIcon.getAttribute("fill")).toBe("none");
    expect(outlineIcon.style.fill).toBe("none");
    expect(outlineIcon.getAttribute("aria-hidden")).toBe("true");

    const filledIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    applyAppIconAttributes(filledIcon);

    expect(filledIcon.getAttribute("fill")).toBe("currentColor");
  });
});

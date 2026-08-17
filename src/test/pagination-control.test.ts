import { afterEach, describe, expect, it, vi } from "vitest";

import "../components/pagination-control";

describe("PaginationControl", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("defaults to 20 items and offers the supported page sizes", async () => {
    const element = document.createElement("pagination-control");
    element.totalPages = 3;
    element.totalItems = 45;
    document.body.appendChild(element);
    await element.updateComplete;

    const select = element.shadowRoot?.querySelector<HTMLSelectElement>("select");
    expect(element.itemsPerPage).toBe(20);
    expect(Array.from(select?.options ?? []).map((option) => Number(option.value))).toEqual([
      10, 20, 50, 100,
    ]);
    expect(select?.value).toBe("20");
  });

  it("emits the selected page size", async () => {
    const element = document.createElement("pagination-control");
    element.totalPages = 3;
    element.totalItems = 45;
    document.body.appendChild(element);
    await element.updateComplete;
    const listener = vi.fn();
    element.addEventListener("per-page-change", listener);

    const select = element.shadowRoot?.querySelector<HTMLSelectElement>("select");
    if (!select) throw new Error("Expected page-size select");
    select.value = "50";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ perPage: 50 });
  });
});

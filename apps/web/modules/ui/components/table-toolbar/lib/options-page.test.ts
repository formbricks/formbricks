import { describe, expect, test } from "vitest";
import { toFilterOptionsPage } from "./options-page";

describe("toFilterOptionsPage", () => {
  test("reads a plain list as complete", () => {
    expect(toFilterOptionsPage([])).toEqual({ options: [], hasMore: false });
    expect(toFilterOptionsPage([{ value: "a", label: "A" }])).toEqual({
      options: [{ value: "a", label: "A" }],
      hasMore: false,
    });
  });

  test("keeps a page's hasMore, so the list can ask for a narrower search (U5)", () => {
    const options = Array.from({ length: 100 }, (_, index) => ({ value: `v${index}`, label: `v${index}` }));
    expect(toFilterOptionsPage({ options, hasMore: true })).toEqual({ options, hasMore: true });
  });
});

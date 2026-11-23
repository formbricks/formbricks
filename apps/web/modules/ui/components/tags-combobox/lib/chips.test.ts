import { describe, expect, test } from "vitest";
import {
  addChips,
  canOfferNewChip,
  filterChipSuggestions,
  hasChipSeparator,
  removeChipAt,
  splitChipInput,
} from "./chips";

describe("splitChipInput", () => {
  test("splits a paste on commas, semicolons and new lines, trimmed and without blanks", () => {
    expect(splitChipInput("Sweden; Norway")).toEqual(["Sweden", "Norway"]);
    expect(splitChipInput(" Sweden ,, Norway;\nDenmark ; ")).toEqual(["Sweden", "Norway", "Denmark"]);
    expect(splitChipInput("   ")).toEqual([]);
  });

  test("hasChipSeparator tells a multi-value paste from plain text", () => {
    expect(hasChipSeparator("Sweden; Norway")).toBe(true);
    expect(hasChipSeparator("New Zealand")).toBe(false);
  });
});

describe("addChips", () => {
  test("appends in order, trimmed, ignoring duplicates case-insensitively", () => {
    expect(addChips(["Sweden"], ["sweden ", " Norway", "NORWAY", "Denmark"])).toEqual([
      "Sweden",
      "Norway",
      "Denmark",
    ]);
  });

  test("returns the same array when nothing is added, so a caller can skip an update", () => {
    const current = ["Sweden"];
    expect(addChips(current, ["SWEDEN", "  "])).toBe(current);
  });

  test("stops at maxValues and cuts a value to maxLength", () => {
    expect(addChips(["a"], ["b", "c", "d"], { maxValues: 3 })).toEqual(["a", "b", "c"]);
    expect(addChips([], ["abcdef"], { maxLength: 3 })).toEqual(["abc"]);
  });
});

describe("removeChipAt", () => {
  test("removes only the chip at the index", () => {
    expect(removeChipAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeChipAt(["a"], 5)).toEqual(["a"]);
  });
});

describe("filterChipSuggestions", () => {
  test("offers values not chosen that contain the query, ignoring case, once each", () => {
    expect(filterChipSuggestions(["Sweden", "Norway", "Swaziland", "sweden"], ["Norway"], "sw")).toEqual([
      "Sweden",
      "Swaziland",
    ]);
  });

  test("offers every unchosen value for an empty query, up to the limit", () => {
    expect(filterChipSuggestions(["a", "b", "c"], ["b"], "", 1)).toEqual(["a"]);
  });
});

describe("canOfferNewChip", () => {
  test("offers Add for new text only", () => {
    expect(canOfferNewChip("Finland", ["Sweden"], [])).toBe(true);
    expect(canOfferNewChip("  ", [], [])).toBe(false);
    expect(canOfferNewChip("sweden", ["Sweden"], [])).toBe(false);
    // A suggestion with that exact value is offered instead, keeping its spelling.
    expect(canOfferNewChip("norway", [], ["Norway"])).toBe(false);
  });
});

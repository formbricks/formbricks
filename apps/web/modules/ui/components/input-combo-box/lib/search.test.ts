import { describe, expect, test } from "vitest";
import { filterComboboxOption, scoreComboboxOption } from "./search";

describe("scoreComboboxOption", () => {
  test("keeps options whose label contains the query", () => {
    expect(scoreComboboxOption("Asia/Tokyo", "tokyo")).toBeGreaterThan(0);
    expect(scoreComboboxOption("Asia/Manila", "manila")).toBeGreaterThan(0);
    expect(scoreComboboxOption("Harsh Bhat", "harsh")).toBeGreaterThan(0);
  });

  test("drops options that only match as a scattered subsequence", () => {
    // The reported bug. cmdk's commandScore is a subsequence matcher, so it scores each of these
    // above zero (0.0029 for Bhagya/harsh, 0.0008 for Monticello/tokyo) and cmdk keeps anything
    // above zero — which is how a search for "harsh" listed "Bhagya Amarasinghe".
    expect(scoreComboboxOption("Bhagya Amarasinghe", "harsh")).toBe(0);
    expect(scoreComboboxOption("America/Kentucky/Monticello", "tokyo")).toBe(0);
    expect(scoreComboboxOption("Europe/Isle_of_Man", "manila")).toBe(0);
    expect(scoreComboboxOption("America/Anguilla", "manila")).toBe(0);
  });

  test("ranks a whole-label match over a prefix, a word prefix and a bare substring", () => {
    const exact = scoreComboboxOption("Asia/Tokyo", "asia/tokyo");
    const prefix = scoreComboboxOption("Asia/Tokyo", "asia");
    const wordPrefix = scoreComboboxOption("Asia/Tokyo", "tok");
    const contains = scoreComboboxOption("Asia/Tokyo", "okyo");

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(0);
  });

  test("matches each term of a multi-word query separately", () => {
    expect(scoreComboboxOption("America/Los_Angeles", "los angeles")).toBeGreaterThan(0);
    expect(scoreComboboxOption("Harsh Bhat", "bhat harsh")).toBeGreaterThan(0);
    // One term missing is still no match.
    expect(scoreComboboxOption("America/Los_Angeles", "los tokyo")).toBe(0);
  });

  test("ignores case and accents", () => {
    expect(scoreComboboxOption("Europe/Zürich", "zurich")).toBeGreaterThan(0);
    expect(scoreComboboxOption("José Álvarez", "jose")).toBeGreaterThan(0);
    expect(scoreComboboxOption("Asia/Tokyo", "  TOKYO ")).toBeGreaterThan(0);
  });

  test("keeps every option while the search box is empty", () => {
    expect(scoreComboboxOption("Asia/Tokyo", "")).toBeGreaterThan(0);
    expect(scoreComboboxOption("Asia/Tokyo", "   ")).toBeGreaterThan(0);
  });

  test("drops an option with no label rather than matching everything", () => {
    expect(scoreComboboxOption("", "tokyo")).toBe(0);
  });
});

describe("filterComboboxOption", () => {
  test("scores the label and not the option's id", () => {
    // A member option is `{ label: "Bhagya Amarasinghe", value: <cuid> }`. Before the fix cmdk
    // searched `value + " " + keywords`, so the cuid's characters could carry the match.
    expect(filterComboboxOption("cmg8x1k2p0001abcd", "harsh", ["Bhagya Amarasinghe"])).toBe(0);
    expect(filterComboboxOption("cmg8x1k2p0002efgh", "harsh", ["Harsh Bhat"])).toBeGreaterThan(0);
  });

  test("does not let a label duplicated into the value match across the two copies", () => {
    // The timezone picker sets label === value, so cmdk's haystack was the label twice over and a
    // query could match by straddling the join.
    expect(
      filterComboboxOption("America/Kentucky/Monticello", "tokyo", ["America/Kentucky/Monticello"])
    ).toBe(0);
  });

  test("falls back to the value when an item carries no keywords", () => {
    expect(filterComboboxOption("Asia/Tokyo", "tokyo")).toBeGreaterThan(0);
    expect(filterComboboxOption("Asia/Tokyo", "tokyo", [])).toBeGreaterThan(0);
  });
});

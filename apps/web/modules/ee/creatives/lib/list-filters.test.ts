import { describe, expect, test } from "vitest";
import {
  INITIAL_CREATIVE_FILTERS,
  type TCreativeListFilters,
  hasActiveCreativeFilters,
  parseStoredCreativeFilters,
} from "./list-filters";

describe("hasActiveCreativeFilters", () => {
  test("ignores the sort and a blank search", () => {
    expect(hasActiveCreativeFilters({ ...INITIAL_CREATIVE_FILTERS, sortBy: "name", name: "  " })).toBe(false);
    expect(hasActiveCreativeFilters({ ...INITIAL_CREATIVE_FILTERS, types: ["banner"] })).toBe(true);
    expect(hasActiveCreativeFilters({ ...INITIAL_CREATIVE_FILTERS, displayStatuses: ["archived"] })).toBe(
      true
    );
  });
});

describe("parseStoredCreativeFilters", () => {
  test("reads back filters the list stored", () => {
    const stored: TCreativeListFilters = {
      name: "notice",
      displayStatuses: ["active", "scheduled"],
      types: ["feedbackButton"],
      sortBy: "createdAt",
    };

    expect(parseStoredCreativeFilters(JSON.stringify(stored))).toEqual(stored);
  });

  test("gives up on anything else, so the toolbar falls back to its defaults", () => {
    expect(parseStoredCreativeFilters(null)).toBeNull();
    expect(parseStoredCreativeFilters("{not json")).toBeNull();
    expect(
      parseStoredCreativeFilters(JSON.stringify({ ...INITIAL_CREATIVE_FILTERS, displayStatuses: ["live"] }))
    ).toBeNull();
    // The mock list stored its filters under other names and spellings.
    expect(
      parseStoredCreativeFilters(JSON.stringify({ name: "", status: [], type: ["feedback_button"] }))
    ).toBeNull();
  });
});

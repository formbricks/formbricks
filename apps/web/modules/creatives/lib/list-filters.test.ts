import { describe, expect, test } from "vitest";
import { MOCK_CREATIVES } from "../mock/data";
import type { TCreativeDisplayStatus } from "./display-status";
import {
  INITIAL_CREATIVE_FILTERS,
  type TCreativeListRow,
  filterCreativeRows,
  hasActiveCreativeFilters,
} from "./list-filters";

const statuses: TCreativeDisplayStatus[] = ["active", "scheduled", "draft", "paused", "closed", "archived"];
const rows: TCreativeListRow[] = MOCK_CREATIVES.map((creative, index) => ({
  creative: { ...creative, name: `${String.fromCodePoint(70 - index)} ${creative.name}` },
  state: { status: statuses[index], reason: null },
}));
const names = (result: TCreativeListRow[]) => result.map((row) => row.creative.id);

describe("filterCreativeRows", () => {
  test("hides archived rows by default and shows them only when Archived is picked", () => {
    expect(names(filterCreativeRows(rows, INITIAL_CREATIVE_FILTERS))).not.toContain("crv_spring_banner");
    expect(names(filterCreativeRows(rows, { ...INITIAL_CREATIVE_FILTERS, status: ["archived"] }))).toEqual([
      "crv_spring_banner",
    ]);
  });

  test("combines status, type and a case-insensitive name search", () => {
    const result = filterCreativeRows(rows, {
      ...INITIAL_CREATIVE_FILTERS,
      status: ["active", "scheduled", "draft"],
      type: ["banner"],
      name: "NOTICE",
    });
    expect(names(result)).toEqual(["crv_open_enrollment"]);
  });

  test("sorts by name, or newest first by date", () => {
    const byName = filterCreativeRows(rows, { ...INITIAL_CREATIVE_FILTERS, sortBy: "name" });
    expect(byName[0].creative.name.startsWith("B")).toBe(true);
    const byCreated = filterCreativeRows(rows, { ...INITIAL_CREATIVE_FILTERS, sortBy: "createdAt" });
    expect(names(byCreated)[0]).toBe("crv_maintenance");
  });
});

describe("hasActiveCreativeFilters", () => {
  test("ignores the sort and a blank search", () => {
    expect(hasActiveCreativeFilters({ ...INITIAL_CREATIVE_FILTERS, sortBy: "name", name: "  " })).toBe(false);
    expect(hasActiveCreativeFilters({ ...INITIAL_CREATIVE_FILTERS, type: ["banner"] })).toBe(true);
  });
});

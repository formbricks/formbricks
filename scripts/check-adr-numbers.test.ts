import { describe, expect, test } from "vitest";
import { findDuplicateAdrNumbers } from "./check-adr-numbers.mjs";

describe("findDuplicateAdrNumbers", () => {
  test("reports a number two ADRs share", () => {
    expect(
      findDuplicateAdrNumbers([
        "0003-one-creative-table.md",
        "0003-tables-filter-server-side-through-one-shape.md",
        "0004-store-intent-derive-status.md",
      ])
    ).toEqual(
      new Map([
        ["0003", ["0003-one-creative-table.md", "0003-tables-filter-server-side-through-one-shape.md"]],
      ])
    );
  });

  test("ignores unique numbers and files that are not ADRs", () => {
    expect(findDuplicateAdrNumbers(["0001-a.md", "0002-b.md", "README.md", "template.md"]).size).toBe(0);
  });
});

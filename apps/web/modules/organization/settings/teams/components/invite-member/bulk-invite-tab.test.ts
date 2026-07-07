import { describe, expect, test } from "vitest";
import {
  type BulkCsvRow,
  parseTeamCell,
  readCell,
} from "@/modules/organization/settings/teams/components/invite-member/bulk-invite-tab";

// Regression coverage for ENG-1596: rows from PapaParse are typed as string maps but a
// missing/misnamed column is undefined at runtime. Cell access must degrade to "" (so
// Zod validation surfaces the CSV error) instead of throwing on `.trim()`.
describe("readCell", () => {
  test("returns the first non-empty value across header aliases", () => {
    const row: BulkCsvRow = { "Email Address": "user@example.com", email: "ignored@example.com" };
    expect(readCell(row, "Email Address", "email")).toBe("user@example.com");
  });

  test("falls back to the alias header when the primary is absent", () => {
    const row: BulkCsvRow = { email: "user@example.com" };
    expect(readCell(row, "Email Address", "email")).toBe("user@example.com");
  });

  test("returns an empty string for a missing column instead of throwing (ENG-1596)", () => {
    const row: BulkCsvRow = { "Full Name": "Ada" };
    expect(readCell(row, "Email Address", "email")).toBe("");
    // downstream code calls .trim() on the result — must be safe
    expect(() => readCell(row, "Email Address", "email").trim()).not.toThrow();
  });

  test("treats undefined and empty cell values as missing", () => {
    const row: BulkCsvRow = { "Email Address": undefined, email: "" };
    expect(readCell(row, "Email Address", "email")).toBe("");
  });

  test("does not match a BOM-prefixed or differently-cased header", () => {
    const row: BulkCsvRow = { "﻿Full Name": "Ada", "full name": "Ada" };
    expect(readCell(row, "Full Name", "name")).toBe("");
  });
});

describe("parseTeamCell", () => {
  test("splits on commas and pipes, trimming whitespace", () => {
    expect(parseTeamCell("Design, Engineering | Sales")).toEqual(["Design", "Engineering", "Sales"]);
  });

  test("drops empty segments", () => {
    expect(parseTeamCell(" , Design,, ")).toEqual(["Design"]);
  });

  test("returns an empty list for undefined or empty cells", () => {
    expect(parseTeamCell(undefined)).toEqual([]);
    expect(parseTeamCell("")).toEqual([]);
  });
});

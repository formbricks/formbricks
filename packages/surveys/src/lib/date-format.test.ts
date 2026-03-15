import { describe, expect, test } from "vitest";
import { parseDateByFormat, parseDateWithFormats } from "./date-format";

describe("parseDateByFormat", () => {
  test("parses ISO (y-M-d) string with default format", () => {
    const result = parseDateByFormat("2024-03-13");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(13);
  });

  test("parses ISO string with explicit y-M-d format", () => {
    const result = parseDateByFormat("2024-01-05", "y-M-d");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(5);
  });

  test("parses d-M-y string (DD-MM-YYYY)", () => {
    const result = parseDateByFormat("13-03-2024", "d-M-y");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(13);
  });

  test("parses M-d-y string (MM-DD-YYYY)", () => {
    const result = parseDateByFormat("03-13-2024", "M-d-y");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(13);
  });

  test("backward compat: value starting with 4 digits (YYYY) parses as ISO regardless of format", () => {
    const value = "2024-03-13";
    expect(parseDateByFormat(value, "d-M-y")).not.toBeNull();
    expect(parseDateByFormat(value, "d-M-y")!.getDate()).toBe(13);
    expect(parseDateByFormat(value, "M-d-y")).not.toBeNull();
    expect(parseDateByFormat(value, "M-d-y")!.getDate()).toBe(13);
  });

  test("backward compat: single-digit month/day in ISO-style parses", () => {
    const result = parseDateByFormat("2024-3-5");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });

  test("returns null for empty string", () => {
    expect(parseDateByFormat("")).toBeNull();
  });

  test("returns null for malformed string (not three parts)", () => {
    expect(parseDateByFormat("2024-03")).toBeNull();
    expect(parseDateByFormat("2024")).toBeNull();
    expect(parseDateByFormat("a-b-c")).toBeNull();
  });

  test("returns null for invalid numbers (e.g. month 13)", () => {
    expect(parseDateByFormat("2024-13-01")).toBeNull();
    expect(parseDateByFormat("2024-00-01")).toBeNull();
    expect(parseDateByFormat("32-03-2024", "d-M-y")).toBeNull();
  });

  test("returns null for invalid date (e.g. Feb 30)", () => {
    expect(parseDateByFormat("2024-02-30")).toBeNull();
  });

  test("trims whitespace", () => {
    const result = parseDateByFormat("  2024-03-13  ");
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(13);
  });

  test("leap year parses correctly", () => {
    const result = parseDateByFormat("2024-02-29");
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(1);
    expect(result!.getDate()).toBe(29);
  });

  test("single-digit month/day in d-M-y format", () => {
    const result = parseDateByFormat("5-3-2024", "d-M-y");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });

  test("single-digit month/day in M-d-y format", () => {
    const result = parseDateByFormat("3-5-2024", "M-d-y");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });
});

describe("parseDateWithFormats", () => {
  test("parses ISO string (y-M-d)", () => {
    const result = parseDateWithFormats("2024-03-13");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getDate()).toBe(13);
  });

  test("parses d-M-y string when format unknown", () => {
    const result = parseDateWithFormats("20-03-2026");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(20);
  });

  test("parses M-d-y string when format unknown", () => {
    const result = parseDateWithFormats("03-20-2026");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(20);
  });

  test("returns null for unparseable string", () => {
    expect(parseDateWithFormats("not-a-date")).toBeNull();
    expect(parseDateWithFormats("")).toBeNull();
  });
});

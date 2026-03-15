import { describe, expect, test } from "vitest";
import { formatStoredDateForDisplay } from "./date-display";

describe("formatStoredDateForDisplay", () => {
  test("returns formatted date for valid ISO string (y-M-d)", () => {
    const result = formatStoredDateForDisplay("2024-03-13", "y-M-d", "fallback");
    expect(result).toContain("2024");
    expect(result).toContain("13");
    expect(result).not.toBe("fallback");
  });

  test("returns formatted date for valid d-M-y string", () => {
    const result = formatStoredDateForDisplay("20-03-2026", "d-M-y", "fallback");
    expect(result).toContain("2026");
    expect(result).toContain("20");
    expect(result).not.toBe("fallback");
  });

  test("returns formatted date for valid M-d-y string", () => {
    const result = formatStoredDateForDisplay("03-20-2026", "M-d-y", "fallback");
    expect(result).toContain("2026");
    expect(result).toContain("20");
    expect(result).not.toBe("fallback");
  });

  test("returns fallback when value is unparseable", () => {
    const fallback = "Invalid date(bad)";
    const result = formatStoredDateForDisplay("bad", "y-M-d", fallback);
    expect(result).toBe(fallback);
  });

  test("returns fallback when value is empty", () => {
    const fallback = "—";
    const result = formatStoredDateForDisplay("", "y-M-d", fallback);
    expect(result).toBe(fallback);
  });

  test("returns fallback when value is malformed (wrong format)", () => {
    const fallback = "Invalid date(13-03-2024)";
    const result = formatStoredDateForDisplay("13-03-2024", "y-M-d", fallback);
    expect(result).toBe(fallback);
  });
});

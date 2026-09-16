import { describe, expect, test } from "vitest";
import { resolveAIDateRange } from "./ai-chart-date-range";

describe("resolveAIDateRange", () => {
  test("passes a named preset straight through", () => {
    expect(resolveAIDateRange({ preset: "last 30 days", start: null, end: null })).toBe("last 30 days");
  });

  test("prefers the preset over explicit dates, so the chart still means the same window later", () => {
    expect(resolveAIDateRange({ preset: "this month", start: "2026-09-01", end: "2026-09-30" })).toBe(
      "this month"
    );
  });

  test("returns an explicit pair when no preset covers the request", () => {
    expect(resolveAIDateRange({ preset: null, start: "2026-08-01", end: "2026-09-30" })).toEqual([
      "2026-08-01",
      "2026-09-30",
    ]);
  });

  test("reads a reversed pair as the window it names", () => {
    expect(resolveAIDateRange({ preset: null, start: "2026-09-30", end: "2026-08-01" })).toEqual([
      "2026-08-01",
      "2026-09-30",
    ]);
  });

  test("drops the ISO 8601 interval the model used to smuggle into a single field", () => {
    expect(
      resolveAIDateRange({
        preset: null,
        start: "2026-08-01T00:00:00.000Z/2026-09-30T23:59:59.999Z",
        end: null,
      })
    ).toBeUndefined();
  });

  test("drops a timestamp, which Cube would read as a different window than the day meant", () => {
    expect(
      resolveAIDateRange({ preset: null, start: "2026-08-01T00:00:00.000Z", end: "2026-09-30T23:59:59.999Z" })
    ).toBeUndefined();
  });

  test("drops a date that does not exist rather than letting Date roll it forward", () => {
    expect(resolveAIDateRange({ preset: null, start: "2026-02-31", end: "2026-03-05" })).toBeUndefined();
  });

  test("drops a half-given range", () => {
    expect(resolveAIDateRange({ preset: null, start: "2026-08-01", end: null })).toBeUndefined();
    expect(resolveAIDateRange({ preset: null, start: null, end: "2026-09-30" })).toBeUndefined();
  });

  test("returns nothing when the model asked for no range at all", () => {
    expect(resolveAIDateRange({})).toBeUndefined();
    expect(resolveAIDateRange({ preset: "  ", start: "  ", end: "  " })).toBeUndefined();
  });
});

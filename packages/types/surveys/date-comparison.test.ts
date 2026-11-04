import { describe, expect, test } from "vitest";
import { compareDateValues } from "./date-comparison";

describe("compareDateValues: how both logic engines order two stored dates", () => {
  test("two calendar dates compare by day", () => {
    expect(compareDateValues("2026-11-03", "2026-11-04")).toBe(-1);
    expect(compareDateValues("2026-11-04", "2026-11-04")).toBe(0);
    expect(compareDateValues("2026-11-05", "2026-11-04")).toBe(1);
  });

  test("a timestamp against a calendar date compares the timestamp's UTC day (P4)", () => {
    // now() on 4 Nov at 10:12 UTC is neither before nor after 4 Nov: it is that day.
    expect(compareDateValues("2026-11-04T10:12:30.000Z", "2026-11-04")).toBe(0);
    expect(compareDateValues("2026-11-04T10:12:30.000Z", "2026-11-03")).toBe(1);
    expect(compareDateValues("2026-11-04T10:12:30.000Z", "2026-11-05")).toBe(-1);
    expect(compareDateValues("2026-11-04", "2026-11-04T23:59:59.999Z")).toBe(0);
    // An offset is read as the instant it names: 01:00 at +02:00 is still 3 Nov in UTC.
    expect(compareDateValues("2026-11-04T01:00:00+02:00", "2026-11-04")).toBe(-1);
  });

  test("two timestamps compare by instant", () => {
    expect(compareDateValues("2026-11-04T10:12:30.000Z", "2026-11-04T10:12:31.000Z")).toBe(-1);
    expect(compareDateValues("2026-11-04T10:12:30.000Z", "2026-11-04T10:12:30.000Z")).toBe(0);
    expect(compareDateValues("2026-11-04T12:00:00+02:00", "2026-11-04T09:59:00Z")).toBe(1);
  });

  test.each([
    ["", "2026-11-04"],
    ["2026-11-04", undefined],
    ["11/04/2026", "2026-11-04"],
    ["2026-13-45", "2026-11-04"],
    [20261104, "2026-11-04"],
  ])("is undefined when %j or %j is not an ISO date, so the engine keeps its old reading", (left, right) => {
    expect(compareDateValues(left, right)).toBeUndefined();
  });
});

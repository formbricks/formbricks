import { describe, expect, test } from "vitest";
import { compareDateValues, isDateAfter, isDateBefore } from "./date-comparison";

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

describe("isDateAfter / isDateBefore", () => {
  test("compare a timestamp against a picked day by day", () => {
    expect(isDateAfter("2026-11-04T10:12:00.000Z", "2026-11-04")).toBe(false);
    expect(isDateBefore("2026-11-04T10:12:00.000Z", "2026-11-04")).toBe(false);
    expect(isDateAfter("2026-11-05T00:00:01.000Z", "2026-11-04")).toBe(true);
    expect(isDateBefore("2026-11-03T23:59:59.000Z", "2026-11-04")).toBe(true);
  });

  test("read other text and numbers as Date always did", () => {
    expect(isDateAfter("Nov 5, 2026", "Nov 4, 2026")).toBe(true);
    expect(isDateBefore("Nov 4, 2026", "Nov 5, 2026")).toBe(true);
    expect(isDateAfter("2027", 2026)).toBe(true);
  });

  test.each([
    [{ day: "2026-11-05" }, "2026-11-04"],
    [undefined, "2026-11-04"],
    [true, "2026-11-04"],
    ["gold", "2026-11-04"],
  ])("are false for %j, which is not a date", (left, right) => {
    expect(isDateAfter(left, right)).toBe(false);
    expect(isDateBefore(left, right)).toBe(false);
  });
});

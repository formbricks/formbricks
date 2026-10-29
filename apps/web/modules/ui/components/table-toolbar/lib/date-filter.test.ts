import { describe, expect, test } from "vitest";
import { formatCalendarDay, parseCalendarDay, resolveDateFilterBounds } from "./date-filter";

describe("formatCalendarDay", () => {
  test("zero-pads month and day", () => {
    expect(formatCalendarDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("round-trips with parseCalendarDay", () => {
    expect(formatCalendarDay(parseCalendarDay("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("resolveDateFilterBounds", () => {
  test("is null for an unknown or missing preset", () => {
    expect(
      resolveDateFilterBounds({ property: "d", operator: "preset", values: ["someday"] }, "UTC")
    ).toBeNull();
    expect(resolveDateFilterBounds({ property: "d", operator: "preset", values: [] }, "UTC")).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import {
  getCurrentFixedCETCalendarDate,
  normalizeDateOnlySelectionToCETMidnight,
  toCalendarDate,
  toDateOnlySelection,
} from "./date-utils";

describe("survey scheduling date utils", () => {
  test("stores selected dates as noon UTC date-only values", () => {
    const selectedDate = new Date(2026, 3, 17, 9, 15, 0, 0);
    const storedDate = toDateOnlySelection(selectedDate);

    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  test("round-trips stored date-only values back to the selected calendar day", () => {
    const storedDate = new Date("2026-04-17T12:00:00.000Z");
    const calendarDate = toCalendarDate(storedDate);

    expect(calendarDate.getFullYear()).toBe(2026);
    expect(calendarDate.getMonth()).toBe(3);
    expect(calendarDate.getDate()).toBe(17);
    expect(calendarDate.getHours()).toBe(12);
  });

  test("normalizes selected dates to fixed CET midnight", () => {
    const storedDate = new Date("2026-04-17T12:00:00.000Z");

    expect(normalizeDateOnlySelectionToCETMidnight(storedDate)?.toISOString()).toBe(
      "2026-04-16T23:00:00.000Z"
    );
  });

  test("fixed CET normalization does not drift during summer time", () => {
    const storedDate = new Date("2026-07-10T12:00:00.000Z");

    expect(normalizeDateOnlySelectionToCETMidnight(storedDate)?.toISOString()).toBe(
      "2026-07-09T23:00:00.000Z"
    );
  });

  test("uses the current CET calendar day for minimum selectable scheduling dates", () => {
    const minSelectableDate = getCurrentFixedCETCalendarDate(new Date("2026-04-16T23:30:00.000Z"));

    expect(minSelectableDate.getFullYear()).toBe(2026);
    expect(minSelectableDate.getMonth()).toBe(3);
    expect(minSelectableDate.getDate()).toBe(17);
    expect(minSelectableDate.getHours()).toBe(12);
  });
});

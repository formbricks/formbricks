import { describe, expect, test } from "vitest";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TRelativeDateBound, TValidationRule } from "@formbricks/types/surveys/validation-rules";
import {
  addCalendarDays,
  addWorkingDays,
  getDateBoundsFromRules,
  resolveRelativeDate,
  shiftISODate,
  toISODateString,
} from "./date-utils";

// 2026-03-04 is a Wednesday, 2026-03-07 a Saturday, 2026-03-09 a Monday.
const wednesday = new Date(2026, 2, 4);
const saturday = new Date(2026, 2, 7);
const monday = new Date(2026, 2, 9);

const buildDateElement = (rules: TValidationRule[], logic: "and" | "or" = "and"): TSurveyElement =>
  ({
    id: "date-element",
    type: TSurveyElementTypeEnum.Date,
    headline: { default: "When?" },
    required: false,
    format: "y-M-d",
    validation: { rules, logic },
  }) as unknown as TSurveyElement;

const bound = (
  amount: number,
  direction: "before" | "after",
  unit: "calendarDays" | "workingDays" = "calendarDays"
): TRelativeDateBound => ({ amount, unit, direction });

describe("toISODateString", () => {
  test("formats using local calendar fields, not UTC", () => {
    expect(toISODateString(new Date(2026, 0, 1, 23, 30))).toBe("2026-01-01");
    expect(toISODateString(new Date(2026, 11, 31, 0, 15))).toBe("2026-12-31");
  });

  test("pads single-digit months and days", () => {
    expect(toISODateString(new Date(2026, 8, 5))).toBe("2026-09-05");
  });
});

describe("addCalendarDays", () => {
  test("moves forward and backward across a weekend without skipping it", () => {
    expect(toISODateString(addCalendarDays(wednesday, 4))).toBe("2026-03-08");
    expect(toISODateString(addCalendarDays(monday, -3))).toBe("2026-03-06");
  });

  test("crosses month and year boundaries", () => {
    expect(toISODateString(addCalendarDays(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(toISODateString(addCalendarDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
  });

  test("returns the reference day for an offset of zero", () => {
    expect(toISODateString(addCalendarDays(saturday, 0))).toBe("2026-03-07");
  });

  test("discards the time part", () => {
    const withTime = new Date(2026, 2, 4, 22, 45);
    expect(addCalendarDays(withTime, 1).getHours()).toBe(0);
  });
});

describe("addWorkingDays", () => {
  test("steps over the weekend when counting forward", () => {
    // Wed + 4 working days lands on the following Tuesday, not Sunday.
    expect(toISODateString(addWorkingDays(wednesday, 4))).toBe("2026-03-10");
  });

  test("steps over the weekend when counting backward", () => {
    // Mon - 3 working days lands on the previous Wednesday.
    expect(toISODateString(addWorkingDays(monday, -3))).toBe("2026-03-04");
  });

  test("leaves a weekend reference date untouched at zero", () => {
    expect(toISODateString(addWorkingDays(saturday, 0))).toBe("2026-03-07");
  });

  test("counts from a weekend reference date into the next weekday", () => {
    expect(toISODateString(addWorkingDays(saturday, 1))).toBe("2026-03-09");
    expect(toISODateString(addWorkingDays(saturday, -1))).toBe("2026-03-06");
  });

  test("crosses a year boundary", () => {
    // 2026-01-01 is a Thursday; three working days back is the previous Monday.
    expect(toISODateString(addWorkingDays(new Date(2026, 0, 1), -3))).toBe("2025-12-29");
  });
});

describe("resolveRelativeDate", () => {
  test("applies direction as the sign of the offset", () => {
    expect(resolveRelativeDate(bound(3, "before"), monday)).toBe("2026-03-06");
    expect(resolveRelativeDate(bound(3, "after"), monday)).toBe("2026-03-12");
  });

  test("honours the working-days unit", () => {
    expect(resolveRelativeDate(bound(3, "before", "workingDays"), monday)).toBe("2026-03-04");
    expect(resolveRelativeDate(bound(4, "after", "workingDays"), wednesday)).toBe("2026-03-10");
  });
});

describe("shiftISODate", () => {
  test("shifts across a month boundary", () => {
    expect(shiftISODate("2026-02-28", 1)).toBe("2026-03-01");
    expect(shiftISODate("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("getDateBoundsFromRules", () => {
  test("returns no bounds when the element has no rules", () => {
    expect(getDateBoundsFromRules(buildDateElement([]), monday)).toEqual({});
  });

  test("shifts fixed bounds by a day because fixed rules are exclusive", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([
        { id: "1", type: "isLaterThan", params: { date: "2026-03-01" } },
        { id: "2", type: "isEarlierThan", params: { date: "2026-03-20" } },
      ]),
      monday
    );

    expect(bounds).toEqual({ minDate: "2026-03-02", maxDate: "2026-03-19" });
  });

  test("keeps relative bounds unshifted because relative rules are inclusive", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([
        { id: "1", type: "isLaterThan", params: { relative: bound(3, "before") } },
        { id: "2", type: "isEarlierThan", params: { relative: bound(4, "after") } },
      ]),
      monday
    );

    expect(bounds).toEqual({ minDate: "2026-03-06", maxDate: "2026-03-13" });
  });

  test("derives both ends from a relative isBetween rule", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([
        {
          id: "1",
          type: "isBetween",
          params: {
            relativeStart: bound(3, "before", "workingDays"),
            relativeEnd: bound(4, "after", "workingDays"),
          },
        },
      ]),
      monday
    );

    expect(bounds).toEqual({ minDate: "2026-03-04", maxDate: "2026-03-13" });
  });

  test("keeps the tightest bound when several rules apply", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([
        { id: "1", type: "isLaterThan", params: { date: "2026-03-01" } },
        { id: "2", type: "isLaterThan", params: { relative: bound(0, "before") } },
      ]),
      monday
    );

    expect(bounds.minDate).toBe("2026-03-09");
  });

  test("ignores isNotBetween because it is a hole, not a bound", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([
        { id: "1", type: "isNotBetween", params: { startDate: "2026-03-05", endDate: "2026-03-12" } },
      ]),
      monday
    );

    expect(bounds).toEqual({});
  });

  test("returns no bounds under or logic, where any single rule may be satisfied", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([{ id: "1", type: "isLaterThan", params: { date: "2026-03-01" } }], "or"),
      monday
    );

    expect(bounds).toEqual({});
  });

  test("ignores malformed fixed dates rather than producing a bogus bound", () => {
    const bounds = getDateBoundsFromRules(
      buildDateElement([{ id: "1", type: "isLaterThan", params: { date: "" } }]),
      monday
    );

    expect(bounds).toEqual({});
  });
});

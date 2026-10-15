import { describe, expect, test } from "vitest";
import {
  combineDayAndTime,
  formatTimeInput,
  getTimeParts,
  parseTimeInput,
  validateDateTimeRange,
} from "./date-time";

describe("parseTimeInput", () => {
  test("parses HH:mm", () => {
    expect(parseTimeInput("02:05")).toEqual({ hours: 2, minutes: 5 });
    expect(parseTimeInput("23:59")).toEqual({ hours: 23, minutes: 59 });
  });

  test("accepts a single-digit hour and surrounding spaces", () => {
    expect(parseTimeInput(" 9:30 ")).toEqual({ hours: 9, minutes: 30 });
  });

  test("rejects empty, malformed and out-of-range input", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("9")).toBeNull();
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("12:60")).toBeNull();
    expect(parseTimeInput("ab:cd")).toBeNull();
  });
});

describe("formatTimeInput", () => {
  test("zero-pads local hours and minutes", () => {
    expect(formatTimeInput(new Date(2026, 9, 15, 2, 5))).toBe("02:05");
    expect(formatTimeInput(new Date(2026, 11, 7, 23, 59))).toBe("23:59");
  });
});

describe("combineDayAndTime", () => {
  test("keeps the calendar day and sets the local time, zeroing seconds", () => {
    const day = new Date(2026, 9, 15, 17, 42, 31, 999);
    const result = combineDayAndTime(day, { hours: 0, minutes: 0 });
    expect(result).toEqual(new Date(2026, 9, 15, 0, 0, 0, 0));
  });

  test("round-trips through formatTimeInput and parseTimeInput", () => {
    const value = combineDayAndTime(new Date(2026, 11, 7), { hours: 23, minutes: 59 });
    expect(parseTimeInput(formatTimeInput(value))).toEqual({ hours: 23, minutes: 59 });
  });
});

describe("getTimeParts", () => {
  test("returns local time parts, or midnight without a date", () => {
    expect(getTimeParts(new Date(2026, 9, 15, 4, 0))).toEqual({ hours: 4, minutes: 0 });
    expect(getTimeParts(null)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("validateDateTimeRange", () => {
  const start = new Date(2026, 9, 15, 2, 0);

  test("accepts an end after the start, and open bounds", () => {
    expect(validateDateTimeRange(start, new Date(2026, 9, 15, 4, 0))).toBeNull();
    expect(validateDateTimeRange(null, start)).toBeNull();
    expect(validateDateTimeRange(start, null)).toBeNull();
    expect(validateDateTimeRange(null, null)).toBeNull();
  });

  test("rejects an end before or equal to the start", () => {
    expect(validateDateTimeRange(start, new Date(2026, 9, 15, 1, 59))).toBe("end_before_start");
    expect(validateDateTimeRange(start, new Date(start))).toBe("end_before_start");
  });
});

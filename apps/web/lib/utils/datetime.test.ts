import { describe, expect, test, vi } from "vitest";
import { diffInDays, formatDateWithOrdinal, getFormattedDateTimeString, isValidDateString } from "./datetime";

describe("datetime utils", () => {
  test("diffInDays calculates the difference in days between two dates", () => {
    const date1 = new Date("2025-05-01");
    const date2 = new Date("2025-05-06");
    expect(diffInDays(date1, date2)).toBe(5);
  });

  test("formatDateWithOrdinal formats a date with ordinal suffix", () => {
    // Create a date that's fixed to May 6, 2025 at noon UTC
    // Using noon ensures the date won't change in most timezones
    const date = new Date(Date.UTC(2025, 4, 6, 12, 0, 0));

    // Test the function
    expect(formatDateWithOrdinal(date)).toBe("Tuesday, May 6th, 2025");
  });

  test("isValidDateString validates correct date strings", () => {
    expect(isValidDateString("2025-05-06")).toBeTruthy();
    expect(isValidDateString("06-05-2025")).toBeTruthy();
    expect(isValidDateString("2025/05/06")).toBeFalsy();
    expect(isValidDateString("invalid-date")).toBeFalsy();
  });

  test("getFormattedDateTimeString formats a date-time string correctly", () => {
    const date = new Date("2025-05-06T14:30:00");
    expect(getFormattedDateTimeString(date)).toBe("2025-05-06 14:30:00");
  });
});

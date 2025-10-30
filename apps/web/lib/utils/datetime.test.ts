import { describe, expect, test, vi } from "vitest";
import { diffInDays, formatDateWithOrdinal, getFormattedDateTimeString, isValidDateString, parseDateOnly } from "./datetime";

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

  describe("parseDateOnly", () => {
    test("should parse date-only string as local date (not UTC)", () => {
      const dateString = "2024-01-15";
      const parsedDate = parseDateOnly(dateString);

      // Verify it's the correct date regardless of timezone
      expect(parsedDate.getFullYear()).toBe(2024);
      expect(parsedDate.getMonth()).toBe(0); // January is 0
      expect(parsedDate.getDate()).toBe(15);
    });

    test("should handle dates that would shift to previous day with UTC parsing", () => {
      // This date would be Jan 14, 23:00 UTC-1 when parsed as UTC
      // But parseDateOnly should give us Jan 15 in local time
      const dateString = "2024-01-15";
      const parsedDate = parseDateOnly(dateString);

      // Should always be January 15th
      expect(parsedDate.getMonth()).toBe(0);
      expect(parsedDate.getDate()).toBe(15);
    });

    test("should parse different dates correctly", () => {
      expect(parseDateOnly("2024-02-29").getDate()).toBe(29); // Leap year
      expect(parseDateOnly("2024-12-31").getDate()).toBe(31);
      expect(parseDateOnly("2023-01-01").getDate()).toBe(1);
    });

    test("should create date at local midnight (not UTC)", () => {
      const dateString = "2024-01-15";
      const parsedDate = parseDateOnly(dateString);

      // Date should be at local midnight (00:00:00)
      expect(parsedDate.getHours()).toBe(0);
      expect(parsedDate.getMinutes()).toBe(0);
      expect(parsedDate.getSeconds()).toBe(0);
    });

    test("should handle edge cases", () => {
      // First day of year
      const jan1 = parseDateOnly("2024-01-01");
      expect(jan1.getMonth()).toBe(0);
      expect(jan1.getDate()).toBe(1);

      // Last day of year
      const dec31 = parseDateOnly("2024-12-31");
      expect(dec31.getMonth()).toBe(11);
      expect(dec31.getDate()).toBe(31);

      // Leap year day
      const leapDay = parseDateOnly("2024-02-29");
      expect(leapDay.getMonth()).toBe(1);
      expect(leapDay.getDate()).toBe(29);
    });
  });
});

import { describe, expect, test } from "vitest";
import {
  diffInDays,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatDateWithOrdinal,
  getFormattedDateTimeString,
  isValidDateString,
} from "./datetime";

describe("datetime utils", () => {
  test("diffInDays calculates the difference in days between two dates", () => {
    const date1 = new Date("2025-05-01");
    const date2 = new Date("2025-05-06");
    expect(diffInDays(date1, date2)).toBe(5);
  });

  test("formatDateWithOrdinal formats a date using the provided locale", () => {
    // Create a date that's fixed to May 6, 2025 at noon UTC
    // Using noon ensures the date won't change in most timezones
    const date = new Date(Date.UTC(2025, 4, 6, 12, 0, 0));

    expect(formatDateWithOrdinal(date)).toBe(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date)
    );
  });

  test("formatDateForDisplay uses the provided locale", () => {
    const date = new Date(Date.UTC(2025, 4, 6, 12, 0, 0));

    expect(formatDateForDisplay(date, "de-DE")).toBe(
      new Intl.DateTimeFormat("de-DE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    );
  });

  test("formatDateTimeForDisplay uses the provided locale", () => {
    const date = new Date(Date.UTC(2025, 4, 6, 12, 30, 0));

    expect(formatDateTimeForDisplay(date, "fr-FR")).toBe(
      new Intl.DateTimeFormat("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    );
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

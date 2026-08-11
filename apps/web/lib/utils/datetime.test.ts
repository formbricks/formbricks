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

  test("getFormattedDateTimeString formats in UTC by default and tags the zone", () => {
    const date = new Date("2025-05-06T14:30:00.000Z");
    expect(getFormattedDateTimeString(date)).toBe("2025-05-06 14:30:00 UTC");
  });

  test("getFormattedDateTimeString formats in the given IANA time zone with a zone marker", () => {
    const date = new Date("2026-01-01T20:00:00.000Z");
    // Asia/Manila is UTC+8, so the formatted date crosses midnight
    expect(getFormattedDateTimeString(date, "Asia/Manila")).toBe("2026-01-02 04:00:00 GMT+8");
  });

  test("getFormattedDateTimeString supports half-hour offset time zones", () => {
    const date = new Date("2026-01-01T20:00:00.000Z");
    // Asia/Kolkata is UTC+5:30
    expect(getFormattedDateTimeString(date, "Asia/Kolkata")).toBe("2026-01-02 01:30:00 IST");
  });

  test("getFormattedDateTimeString formats in UTC when the time zone is explicitly UTC", () => {
    const date = new Date("2026-01-01T20:00:00.000Z");
    expect(getFormattedDateTimeString(date, "UTC")).toBe("2026-01-01 20:00:00 UTC");
  });

  test("getFormattedDateTimeString degrades to UTC when the time zone is invalid", () => {
    const date = new Date("2026-01-01T20:00:00.000Z");
    // An unknown IANA zone makes Intl.DateTimeFormat throw; the export must not fail.
    expect(getFormattedDateTimeString(date, "Not/AZone")).toBe("2026-01-01 20:00:00 UTC");
  });
});

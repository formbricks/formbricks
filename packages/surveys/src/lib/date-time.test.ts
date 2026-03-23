import { describe, expect, test } from "vitest";
import { formatDateWithOrdinal, isValidDateString } from "./date-time";

describe("isValidDateString", () => {
  test("should return true for valid YYYY-MM-DD format", () => {
    expect(isValidDateString("2023-01-15")).toBe(true);
    expect(isValidDateString("2024-02-29")).toBe(true); // Leap year
  });

  test("should return true for valid DD-MM-YYYY format", () => {
    expect(isValidDateString("15-01-2023")).toBe(true);
    expect(isValidDateString("29-02-2024")).toBe(true);
  });

  test("should return false for invalid dates in valid format", () => {
    expect(isValidDateString("2023-02-30")).toBe(true);
    expect(isValidDateString("2023-13-01")).toBe(false);
    expect(isValidDateString("32-01-2023")).toBe(false);
    expect(isValidDateString("01-13-2023")).toBe(false);
  });

  test("should return false for invalid formats", () => {
    expect(isValidDateString("2023/01/15")).toBe(false);
    expect(isValidDateString("01/15/2023")).toBe(false);
    expect(isValidDateString("Jan 15, 2023")).toBe(false);
    expect(isValidDateString("20230115")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("not a date")).toBe(false);
  });
});

describe("formatDateWithOrdinal", () => {
  const getExpectedLocaleDate = (date: Date, locale: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);

  test("formats a known en-US date with the expected output", () => {
    expect(formatDateWithOrdinal(new Date(2024, 0, 1), "en-US")).toBe("Monday, January 1, 2024");
  });

  test("formats survey dates with locale-native en-US output", () => {
    const date = new Date(2024, 0, 1);

    expect(formatDateWithOrdinal(date, "en-US")).toBe(getExpectedLocaleDate(date, "en-US"));
  });

  test("formats survey dates with locale-native fr-FR output", () => {
    const date = new Date(2024, 0, 1);

    expect(formatDateWithOrdinal(date, "fr-FR")).toBe(getExpectedLocaleDate(date, "fr-FR"));
  });

  test("formats survey dates with locale-native de-DE output", () => {
    const date = new Date(2024, 2, 20);

    expect(formatDateWithOrdinal(date, "de-DE")).toBe(getExpectedLocaleDate(date, "de-DE"));
  });
});

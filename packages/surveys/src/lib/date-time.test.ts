import { describe, expect, test } from "vitest";
import { formatDateWithOrdinal, parseDateString } from "./date-time";

describe("parseDateString", () => {
  test("parses valid YYYY-MM-DD format", () => {
    expect(parseDateString("2023-01-15")).not.toBeNull();
    expect(parseDateString("2024-02-29")).not.toBeNull(); // Leap year
  });

  test("parses valid DD-MM-YYYY format", () => {
    expect(parseDateString("15-01-2023")).not.toBeNull();
    expect(parseDateString("29-02-2024")).not.toBeNull();
  });

  test("preserves calendar rollover and rejects dates outside the parser range", () => {
    expect(parseDateString("2023-02-30")).not.toBeNull();
    expect(parseDateString("2023-13-01")).toBeNull();
    expect(parseDateString("32-01-2023")).toBeNull();
    expect(parseDateString("01-13-2023")).toBeNull();
  });

  test("rejects unsupported formats", () => {
    expect(parseDateString("2023/01/15")).toBeNull();
    expect(parseDateString("01/15/2023")).toBeNull();
    expect(parseDateString("Jan 15, 2023")).toBeNull();
    expect(parseDateString("20230115")).toBeNull();
    expect(parseDateString("")).toBeNull();
    expect(parseDateString("not a date")).toBeNull();
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

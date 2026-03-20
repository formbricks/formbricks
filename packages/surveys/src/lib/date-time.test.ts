import { describe, expect, test } from "vitest";
import { formatDateWithOrdinal, getMonthName, getOrdinalDate, isValidDateString } from "./date-time";

describe("getMonthName", () => {
  test("should return correct month name for en-US", () => {
    expect(getMonthName(0)).toBe("January");
    expect(getMonthName(6)).toBe("July");
    expect(getMonthName(11)).toBe("December");
  });

  test("should return correct month name for a different locale (es-ES)", () => {
    expect(getMonthName(0, "es-ES")).toBe("enero");
    expect(getMonthName(6, "es-ES")).toBe("julio");
    expect(getMonthName(11, "es-ES")).toBe("diciembre");
  });

  test("should throw an error for invalid month index", () => {
    expect(() => getMonthName(-1)).toThrow("Month index must be between 0 and 11");
    expect(() => getMonthName(12)).toThrow("Month index must be between 0 and 11");
  });
});

describe("getOrdinalDate", () => {
  test('should return date with "st" for 1, 21, 31 (but not 11)', () => {
    expect(getOrdinalDate(1)).toBe("1st");
    expect(getOrdinalDate(21)).toBe("21st");
    expect(getOrdinalDate(31)).toBe("31st");
  });

  test('should return date with "nd" for 2, 22 (but not 12)', () => {
    expect(getOrdinalDate(2)).toBe("2nd");
    expect(getOrdinalDate(22)).toBe("22nd");
  });

  test('should return date with "rd" for 3, 23 (but not 13)', () => {
    expect(getOrdinalDate(3)).toBe("3rd");
    expect(getOrdinalDate(23)).toBe("23rd");
  });

  test('should return date with "th" for 11, 12, 13 and others', () => {
    expect(getOrdinalDate(4)).toBe("4th");
    expect(getOrdinalDate(11)).toBe("11th");
    expect(getOrdinalDate(12)).toBe("12th");
    expect(getOrdinalDate(13)).toBe("13th");
    expect(getOrdinalDate(15)).toBe("15th");
    expect(getOrdinalDate(20)).toBe("20th");
    expect(getOrdinalDate(24)).toBe("24th");
  });
});

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

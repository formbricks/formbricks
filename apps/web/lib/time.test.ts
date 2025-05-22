import { describe, expect, test, vi } from "vitest";
import {
  convertDateString,
  convertDateTimeString,
  convertDateTimeStringShort,
  convertDatesInObject,
  convertTimeString,
  formatDate,
  getTodaysDateFormatted,
  getTodaysDateTimeFormatted,
  timeSince,
  timeSinceDate,
} from "./time";

describe("Time Utilities", () => {
  describe("convertDateString", () => {
    test("should format date string correctly", () => {
      expect(convertDateString("2024-03-20:12:30:00")).toBe("Mar 20, 2024");
    });

    test("should return empty string for empty input", () => {
      expect(convertDateString("")).toBe("");
    });

    test("should return null for null input", () => {
      expect(convertDateString(null as any)).toBe(null);
    });

    test("should handle invalid date strings", () => {
      expect(convertDateString("not-a-date")).toBe("Invalid Date");
    });
  });

  describe("convertDateTimeString", () => {
    test("should format date and time string correctly", () => {
      expect(convertDateTimeString("2024-03-20T15:30:00")).toBe("Wednesday, March 20, 2024 at 3:30 PM");
    });

    test("should return empty string for empty input", () => {
      expect(convertDateTimeString("")).toBe("");
    });
  });

  describe("convertDateTimeStringShort", () => {
    test("should format date and time string in short format", () => {
      expect(convertDateTimeStringShort("2024-03-20T15:30:00")).toBe("March 20, 2024 at 3:30 PM");
    });

    test("should return empty string for empty input", () => {
      expect(convertDateTimeStringShort("")).toBe("");
    });
  });

  describe("convertTimeString", () => {
    test("should format time string correctly", () => {
      expect(convertTimeString("2024-03-20T15:30:45")).toBe("3:30:45 PM");
    });
  });

  describe("timeSince", () => {
    test("should format time since in English", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSince(oneHourAgo.toISOString(), "en-US")).toBe("about 1 hour ago");
    });

    test("should format time since in German", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSince(oneHourAgo.toISOString(), "de-DE")).toBe("vor etwa 1 Stunde");
    });
  });

  describe("timeSinceDate", () => {
    test("should format time since from Date object", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSinceDate(oneHourAgo)).toBe("about 1 hour ago");
    });
  });

  describe("formatDate", () => {
    test("should format date correctly", () => {
      const date = new Date(2024, 2, 20); // March is month 2 (0-based)
      expect(formatDate(date)).toBe("March 20, 2024");
    });
  });

  describe("getTodaysDateFormatted", () => {
    test("should format today's date with specified separator", () => {
      const today = new Date();
      const expected = today.toISOString().split("T")[0].split("-").join(".");
      expect(getTodaysDateFormatted(".")).toBe(expected);
    });
  });

  describe("getTodaysDateTimeFormatted", () => {
    test("should format today's date and time with specified separator", () => {
      const today = new Date();
      const datePart = today.toISOString().split("T")[0].split("-").join(".");
      const timePart = today.toTimeString().split(" ")[0].split(":").join(".");
      const expected = `${datePart}.${timePart}`;
      expect(getTodaysDateTimeFormatted(".")).toBe(expected);
    });
  });

  describe("convertDatesInObject", () => {
    test("should convert date strings to Date objects in an object", () => {
      const input = {
        id: 1,
        createdAt: "2024-03-20T15:30:00",
        updatedAt: "2024-03-20T16:30:00",
        nested: {
          createdAt: "2024-03-20T17:30:00",
        },
      };

      const result = convertDatesInObject(input);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.nested.createdAt).toBeInstanceOf(Date);
      expect(result.id).toBe(1);
    });

    test("should handle arrays", () => {
      const input = [{ createdAt: "2024-03-20T15:30:00" }, { createdAt: "2024-03-20T16:30:00" }];

      const result = convertDatesInObject(input);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[1].createdAt).toBeInstanceOf(Date);
    });

    test("should return non-objects as is", () => {
      expect(convertDatesInObject(null)).toBe(null);
      expect(convertDatesInObject("string")).toBe("string");
      expect(convertDatesInObject(123)).toBe(123);
    });
  });
});

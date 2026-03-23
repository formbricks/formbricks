import { describe, expect, test } from "vitest";
import {
  convertDatesInObject,
  formatDate,
  getTodaysDateTimeFormatted,
  timeSince,
  timeSinceDate,
} from "./time";

describe("Time Utilities", () => {
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

    test("should format time since in Swedish", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSince(oneHourAgo.toISOString(), "sv-SE")).toBe("ungefär en timme sedan");
    });

    test("should format time since in Brazilian Portuguese", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSince(oneHourAgo.toISOString(), "pt-BR")).toBe("há cerca de 1 hora");
    });

    test("should format time since in European Portuguese", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSince(oneHourAgo.toISOString(), "pt-PT")).toBe("há aproximadamente 1 hora");
    });
  });

  describe("timeSinceDate", () => {
    test("should format time since from Date object", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSinceDate(oneHourAgo)).toBe("about 1 hour ago");
    });

    test("should format time since from Date object in the provided locale", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(timeSinceDate(oneHourAgo, "de-DE")).toBe("vor etwa 1 Stunde");
    });
  });

  describe("formatDate", () => {
    test("should format date correctly", () => {
      const date = new Date(2024, 2, 20); // March is month 2 (0-based)
      expect(formatDate(date)).toBe("March 20, 2024");
    });

    test("should format date with the provided locale", () => {
      const date = new Date(2024, 2, 20);

      expect(formatDate(date, "de-DE")).toBe(
        new Intl.DateTimeFormat("de-DE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(date)
      );
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

    test("should not convert dates in ignored keys when keysToIgnore is provided", () => {
      const keysToIgnore = new Set(["contactAttributes", "variables", "data", "meta"]);
      const input = {
        createdAt: "2024-03-20T15:30:00",
        contactAttributes: {
          createdAt: "2024-03-20T16:30:00",
          email: "test@example.com",
        },
      };

      const result = convertDatesInObject(input, keysToIgnore);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.contactAttributes.createdAt).toBe("2024-03-20T16:30:00");
      expect(result.contactAttributes.email).toBe("test@example.com");
    });

    test("should not convert dates in variables when keysToIgnore is provided", () => {
      const keysToIgnore = new Set(["contactAttributes", "variables", "data", "meta"]);
      const input = {
        updatedAt: "2024-03-20T15:30:00",
        variables: {
          createdAt: "2024-03-20T16:30:00",
          userId: "123",
        },
      };

      const result = convertDatesInObject(input, keysToIgnore);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.variables.createdAt).toBe("2024-03-20T16:30:00");
      expect(result.variables.userId).toBe("123");
    });

    test("should not convert dates in data or meta when keysToIgnore is provided", () => {
      const keysToIgnore = new Set(["contactAttributes", "variables", "data", "meta"]);
      const input = {
        createdAt: "2024-03-20T15:30:00",
        data: {
          createdAt: "2024-03-20T16:30:00",
        },
        meta: {
          updatedAt: "2024-03-20T17:30:00",
        },
      };

      const result = convertDatesInObject(input, keysToIgnore);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.data.createdAt).toBe("2024-03-20T16:30:00");
      expect(result.meta.updatedAt).toBe("2024-03-20T17:30:00");
    });

    test("should recurse into all keys when keysToIgnore is not provided", () => {
      const input = {
        createdAt: "2024-03-20T15:30:00",
        contactAttributes: {
          createdAt: "2024-03-20T16:30:00",
        },
      };

      const result = convertDatesInObject(input);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.contactAttributes.createdAt).toBeInstanceOf(Date);
    });
  });
});

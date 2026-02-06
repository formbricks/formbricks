import { describe, expect, test } from "vitest";
import { addTimeUnit, endOfDay, isSameDay, startOfDay, subtractTimeUnit } from "./date-utils";

describe("date-utils", () => {
  describe("subtractTimeUnit", () => {
    test("subtracts days correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = subtractTimeUnit(date, 5, "days");
      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(0); // January
    });

    test("subtracts weeks correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = subtractTimeUnit(date, 2, "weeks");
      expect(result.getDate()).toBe(1);
    });

    test("subtracts months correctly", () => {
      const date = new Date("2024-03-15T12:00:00Z");
      const result = subtractTimeUnit(date, 2, "months");
      expect(result.getMonth()).toBe(0); // January
    });

    test("subtracts years correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = subtractTimeUnit(date, 1, "years");
      expect(result.getFullYear()).toBe(2023);
    });

    test("does not modify original date", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const original = date.getTime();
      subtractTimeUnit(date, 5, "days");
      expect(date.getTime()).toBe(original);
    });
  });

  describe("addTimeUnit", () => {
    test("adds days correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = addTimeUnit(date, 5, "days");
      expect(result.getDate()).toBe(20);
    });

    test("adds weeks correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = addTimeUnit(date, 2, "weeks");
      expect(result.getDate()).toBe(29);
    });

    test("adds months correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = addTimeUnit(date, 2, "months");
      expect(result.getMonth()).toBe(2); // March
    });

    test("adds years correctly", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = addTimeUnit(date, 1, "years");
      expect(result.getFullYear()).toBe(2025);
    });
  });

  describe("startOfDay", () => {
    test("sets time to 00:00:00.000 UTC", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const result = startOfDay(date);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(result.getUTCDate()).toBe(date.getUTCDate());
    });
  });

  describe("endOfDay", () => {
    test("sets time to 23:59:59.999 UTC", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const result = endOfDay(date);
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
      expect(result.getUTCMilliseconds()).toBe(999);
      expect(result.getUTCDate()).toBe(date.getUTCDate());
    });
  });

  describe("isSameDay", () => {
    test("returns true for dates on the same day", () => {
      const date1 = new Date("2024-01-15T10:00:00Z");
      const date2 = new Date("2024-01-15T22:00:00Z");
      expect(isSameDay(date1, date2)).toBe(true);
    });

    test("returns false for dates on different days", () => {
      const date1 = new Date("2024-01-15T23:59:59Z");
      const date2 = new Date("2024-01-16T00:00:01Z");
      expect(isSameDay(date1, date2)).toBe(false);
    });

    test("returns false for dates in different months", () => {
      const date1 = new Date("2024-01-31T12:00:00Z");
      const date2 = new Date("2024-02-01T12:00:00Z");
      expect(isSameDay(date1, date2)).toBe(false);
    });

    test("returns false for dates in different years", () => {
      const date1 = new Date("2023-12-31T12:00:00Z");
      const date2 = new Date("2024-01-01T12:00:00Z");
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });
});

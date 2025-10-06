import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calculateExpirationDate } from "./utils";

describe("calculateExpirationDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("calculates expiration date for positive days", () => {
    const baseDate = new Date("2024-01-15T12:00:00.000Z");
    vi.setSystemTime(baseDate);

    const result = calculateExpirationDate(7);
    const expectedDate = new Date("2024-01-22T12:00:00.000Z");

    expect(result).toBe(expectedDate.toISOString());
  });

  test("handles zero expiration days", () => {
    const baseDate = new Date("2024-01-15T12:00:00.000Z");
    vi.setSystemTime(baseDate);

    const result = calculateExpirationDate(0);

    expect(result).toBe(baseDate.toISOString());
  });

  test("handles negative expiration days", () => {
    const baseDate = new Date("2024-01-15T12:00:00.000Z");
    vi.setSystemTime(baseDate);

    const result = calculateExpirationDate(-5);
    const expectedDate = new Date("2024-01-10T12:00:00.000Z");

    expect(result).toBe(expectedDate.toISOString());
  });

  test("returns valid ISO string format", () => {
    const baseDate = new Date("2024-01-15T12:00:00.000Z");
    vi.setSystemTime(baseDate);

    const result = calculateExpirationDate(10);
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    expect(result).toMatch(isoRegex);
  });
});

import { describe, expect, test } from "vitest";
import { createColumnStats } from "./column-stats";

describe("createColumnStats", () => {
  test("measures the longest text in bytes, not characters", () => {
    const stats = createColumnStats(2);
    stats.observe(["abc", "أحمر"]);
    stats.observe(["abcdef", null]);
    expect(stats.result().map((entry) => entry.maxTextBytes)).toEqual([6, 8]);
  });

  test("measures numbers on their own: widest written number and most decimals", () => {
    const stats = createColumnStats(1);
    stats.observe([7]);
    stats.observe([-12.5]);
    stats.observe([3.125]);
    stats.observe([null]);
    expect(stats.result()[0]).toMatchObject({ maxTextBytes: 0, maxNumberChars: 5, maxDecimals: 3 });
  });

  test("a column of blanks measures nothing", () => {
    const stats = createColumnStats(1);
    stats.observe([null]);
    expect(stats.result()[0]).toEqual({ maxTextBytes: 0, maxNumberChars: 0, maxDecimals: 0 });
  });

  test("a column that mixes UNMAPPED text and numbers keeps both measures", () => {
    const stats = createColumnStats(1);
    stats.observe([5]);
    stats.observe(["UNMAPPED:n/a"]);
    expect(stats.result()[0]).toEqual({ maxTextBytes: 12, maxNumberChars: 1, maxDecimals: 0 });
  });
});

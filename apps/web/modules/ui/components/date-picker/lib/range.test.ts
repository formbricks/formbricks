import { describe, expect, test } from "vitest";
import {
  type TDateRangeValue,
  applyRangeClick,
  applyRangeHover,
  endOfLocalDay,
  startOfLocalDay,
} from "./range";

// Local-time constructor on purpose: the whole point of these helpers is local calendar days, so a
// `new Date("2026-03-10")` (UTC midnight) fixture would test the wrong thing west of UTC.
const day = (year: number, month: number, date: number, hours = 12) =>
  new Date(year, month - 1, date, hours, 30, 15, 500);

describe("startOfLocalDay / endOfLocalDay", () => {
  test("pins the local day boundaries without shifting the calendar day", () => {
    const start = startOfLocalDay(day(2026, 3, 10));
    const end = endOfLocalDay(day(2026, 3, 10));

    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 2, 10]);
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 2, 10]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([
      23, 59, 59, 999,
    ]);
  });

  test("does not mutate its argument", () => {
    const original = day(2026, 3, 10);
    const snapshot = original.getTime();

    startOfLocalDay(original);
    endOfLocalDay(original);

    expect(original.getTime()).toBe(snapshot);
  });
});

describe("applyRangeClick", () => {
  test("covers the whole last day so a late response on it still matches the filter", () => {
    const result = applyRangeClick({ from: startOfLocalDay(day(2026, 3, 1)) }, "to", day(2026, 3, 31, 9));

    // 09:30 was clicked, but the bound has to reach the end of that day.
    expect(result.range.to?.getHours()).toBe(23);
    expect(result.range.to?.getDate()).toBe(31);
    expect(result.isComplete).toBe(true);
  });

  test("picking 'from' hands the next click to 'to' and does not complete the range", () => {
    const result = applyRangeClick({ from: undefined }, "from", day(2026, 3, 10));

    expect(result.nextBound).toBe("to");
    expect(result.isComplete).toBe(false);
    expect(result.range.to).toBeUndefined();
  });

  test("keeps an existing 'to' when the new 'from' still precedes it", () => {
    const existingTo = endOfLocalDay(day(2026, 3, 31));
    const result = applyRangeClick(
      { from: startOfLocalDay(day(2026, 3, 20)), to: existingTo },
      "from",
      day(2026, 3, 5)
    );

    expect(result.range.from?.getDate()).toBe(5);
    expect(result.range.to).toBe(existingTo);
  });

  test("a 'from' past the current 'to' yields a one-day range at the clicked day, never an inverted one", () => {
    const result = applyRangeClick(
      { from: startOfLocalDay(day(2026, 3, 1)), to: endOfLocalDay(day(2026, 3, 5)) },
      "from",
      day(2026, 3, 20)
    );

    expect(result.range.from?.getDate()).toBe(20);
    expect(result.range.to?.getDate()).toBe(21);
    expect(result.range.from!.getTime()).toBeLessThan(result.range.to!.getTime());
  });

  test("a 'to' before the current 'from' pulls 'from' back instead of inverting", () => {
    const result = applyRangeClick(
      { from: startOfLocalDay(day(2026, 3, 20)), to: endOfLocalDay(day(2026, 3, 25)) },
      "to",
      day(2026, 3, 5)
    );

    expect(result.range.to?.getDate()).toBe(5);
    expect(result.range.from?.getDate()).toBe(4);
    expect(result.range.from!.getTime()).toBeLessThan(result.range.to!.getTime());
  });

  test("crossing a month boundary keeps the adjacent-day fallback correct", () => {
    const result = applyRangeClick(
      { from: startOfLocalDay(day(2026, 3, 1)), to: endOfLocalDay(day(2026, 3, 2)) },
      "from",
      day(2026, 3, 31)
    );

    expect([result.range.to?.getMonth(), result.range.to?.getDate()]).toEqual([3, 1]);
  });

  test("a 'to' click with no 'from' yet leaves the range incomplete", () => {
    const result = applyRangeClick({ from: undefined }, "to", day(2026, 3, 10));

    expect(result.range.from).toBeUndefined();
    expect(result.isComplete).toBe(false);
  });
});

describe("applyRangeHover", () => {
  test("previews the bound under the pointer while keeping the opposite one", () => {
    const existingTo = endOfLocalDay(day(2026, 3, 31));
    const preview = applyRangeHover(
      { from: startOfLocalDay(day(2026, 3, 10)), to: existingTo },
      "from",
      day(2026, 3, 5)
    );

    expect(preview?.from?.getDate()).toBe(5);
    expect(preview?.to).toBe(existingTo);
  });

  test("returns null rather than an inverted preview", () => {
    const range: TDateRangeValue = {
      from: startOfLocalDay(day(2026, 3, 10)),
      to: endOfLocalDay(day(2026, 3, 20)),
    };

    expect(applyRangeHover(range, "from", day(2026, 3, 25))).toBeNull();
    expect(applyRangeHover(range, "to", day(2026, 3, 5))).toBeNull();
  });

  test("previews freely while the opposite bound is still unset", () => {
    expect(applyRangeHover({ from: undefined }, "to", day(2026, 3, 5))?.to?.getDate()).toBe(5);
    expect(applyRangeHover({ from: undefined }, "from", day(2026, 3, 5))?.from?.getDate()).toBe(5);
  });
});

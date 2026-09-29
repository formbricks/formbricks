import { describe, expect, test } from "vitest";
import { ZUsageRangeQuery, resolveUsageRange } from "./range";

// 2026-09-24 10:00 UTC — noon in Berlin (UTC+2 in September).
const NOW = new Date("2026-09-24T10:00:00.000Z");

describe("ZUsageRangeQuery", () => {
  test.each([
    [{ preset: "this_year" }],
    [{ preset: "last_30_days" }],
    [{ preset: "all_time" }],
    [{ from: "2026-01-01", to: "2026-01-31" }],
    [{ from: "2026-03-05", to: "2026-03-05" }],
  ])("accepts %j", (input) => {
    expect(ZUsageRangeQuery.safeParse(input).success).toBe(true);
  });

  test.each([
    ["an inverted range", { from: "2026-02-01", to: "2026-01-01" }],
    ["a day that does not exist", { from: "2026-02-30", to: "2026-03-01" }],
    ["a non-ISO date", { from: "01/02/2026", to: "2026-03-01" }],
    ["only one bound", { from: "2026-01-01" }],
    ["a preset and a range", { preset: "this_year", from: "2026-01-01", to: "2026-01-02" }],
    ["nothing", {}],
  ])("rejects %s", (_label, input) => {
    expect(ZUsageRangeQuery.safeParse(input).success).toBe(false);
  });
});

describe("resolveUsageRange", () => {
  test("all-time leaves both ends open", () => {
    expect(resolveUsageRange({ preset: "all_time" }, "Europe/Berlin", NOW)).toEqual({});
  });

  test("this year starts at local midnight on 1 January in the organization's zone", () => {
    const { from, to } = resolveUsageRange({ preset: "this_year" }, "Europe/Berlin", NOW);

    expect(from?.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-09-24T21:59:59.999Z");
  });

  test("last 30 days covers today and the 29 days before it", () => {
    const { from, to } = resolveUsageRange({ preset: "last_30_days" }, "UTC", NOW);

    expect(from?.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-09-24T23:59:59.999Z");
  });

  test("a custom range includes the whole of its last day", () => {
    const { from, to } = resolveUsageRange({ from: "2026-10-01", to: "2026-10-31" }, "UTC", NOW);

    expect(from?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
  });

  test("a custom range follows the zone across a DST change", () => {
    // Berlin leaves summer time on 25 October 2026, so the two ends sit at different UTC offsets.
    const { from, to } = resolveUsageRange({ from: "2026-10-01", to: "2026-10-31" }, "Europe/Berlin", NOW);

    expect(from?.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-10-31T22:59:59.999Z");
  });
});

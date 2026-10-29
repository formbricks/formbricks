import { describe, expect, test } from "vitest";
import { chartKeys, dashboardKeys, flattenPages } from "./query";

/** TanStack Query invalidates by key prefix: a broad key must be a prefix of every narrow key under it. */
const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((part, index) => Object.is(part, key[index]));

describe("analysis query keys", () => {
  test("nest every chart list, detail and data key under the broad key a write invalidates", () => {
    const list = chartKeys.list({ workspaceId: "w", limit: 25, nameContains: "nps" });
    const detail = chartKeys.detail("c1");
    const data = chartKeys.data("c1", "last_7_days");

    expect(isPrefixOf(chartKeys.lists(), list)).toBe(true);
    expect(isPrefixOf(chartKeys.details(), detail)).toBe(true);
    expect(isPrefixOf(chartKeys.allData(), data)).toBe(true);
    for (const key of [list, detail, data]) expect(isPrefixOf(chartKeys.all, key)).toBe(true);

    // Invalidating the lists must not drop a chart's cached data, and vice versa.
    expect(isPrefixOf(chartKeys.lists(), data)).toBe(false);
    expect(isPrefixOf(chartKeys.allData(), list)).toBe(false);
  });

  test("key a chart's data by both the chart and the date range", () => {
    expect(chartKeys.data("c1", null)).not.toEqual(chartKeys.data("c2", null));
    expect(chartKeys.data("c1", "last_7_days")).not.toEqual(chartKeys.data("c1", null));
    expect(chartKeys.data("c1", { from: "2026-01-01", to: "2026-01-31" })).toEqual(
      chartKeys.data("c1", { from: "2026-01-01", to: "2026-01-31" })
    );
  });

  test("put the dashboard picker's options under the dashboard lists, so a dashboard write refreshes it", () => {
    const options = dashboardKeys.options("w");
    const list = dashboardKeys.list({ workspaceId: "w", limit: 10, chartId: "c1" });

    expect(isPrefixOf(dashboardKeys.lists(), options)).toBe(true);
    expect(isPrefixOf(dashboardKeys.lists(), list)).toBe(true);
    expect(isPrefixOf(dashboardKeys.details(), dashboardKeys.detail("d1"))).toBe(true);
    expect(isPrefixOf(dashboardKeys.lists(), dashboardKeys.detail("d1"))).toBe(false);
    expect(options).not.toEqual(dashboardKeys.options("other"));
  });

  test("keep chart and dashboard keys apart", () => {
    expect(isPrefixOf(chartKeys.all, dashboardKeys.detail("x"))).toBe(false);
    expect(isPrefixOf(dashboardKeys.all, chartKeys.detail("x"))).toBe(false);
  });
});

describe("flattenPages", () => {
  test("joins every loaded page's items in order", () => {
    const page = (data: string[], nextCursor: string | null) => ({ data, meta: { limit: 2, nextCursor } });

    expect(
      flattenPages({ pages: [page(["a", "b"], "c"), page(["c"], null)], pageParams: [null, "c"] })
    ).toEqual(["a", "b", "c"]);
  });

  test("is empty before the first page loads", () => {
    expect(flattenPages<string>(undefined)).toEqual([]);
  });
});

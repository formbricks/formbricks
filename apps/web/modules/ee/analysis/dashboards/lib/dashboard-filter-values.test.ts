import { describe, expect, test, vi } from "vitest";
import { listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import { getDashboardFilterValueProperty } from "./dashboard-filter-values";
import type { TDashboardFilter } from "./dashboard-filters";

vi.mock("@/modules/ee/analysis/lib/api-client", () => ({ listDashboardFilterValues: vi.fn() }));

const filter: TDashboardFilter = {
  id: "clfi000000000000000000001",
  field: "FeedbackRecords.sourceType",
  operator: "equals",
  label: "Source",
};

const property = (picks = {}, dateRange: "last_7_days" | null = "last_7_days") =>
  getDashboardFilterValueProperty({ dashboardId: "d1", filter, otherPicks: picks, dateRange });

const startsWith = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((part, index) => Object.is(part, key[index]));

describe("getDashboardFilterValueProperty", () => {
  test("caches each search under the chart data keys, so a chart edit refreshes the list", () => {
    const key = property().queryKey!("we");
    expect(startsWith(chartKeys.allData(), key)).toBe(true);
  });

  test("keys the list by the filter's field and operator, the other picks, the date range and the search", () => {
    const key = property({ other: ["x"] }).queryKey!("we");
    expect(key).toContainEqual({
      dateRange: "last_7_days",
      picks: { other: ["x"] },
      search: "we",
      field: filter.field,
      operator: filter.operator,
    });
    expect(property({ other: ["y"] }).queryKey!("we")).not.toEqual(key);
    expect(property({ other: ["x"] }, null).queryKey!("we")).not.toEqual(key);
    expect(property({ other: ["x"] }).queryKey!("w")).not.toEqual(key);
  });

  test("loads through the dashboard with the abort signal, and returns a page", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({
      values: [{ value: "Web", count: 3 }],
      hasMore: true,
    } as never);
    const controller = new AbortController();

    await expect(property({ other: ["x"] }).loadOptions!("we", controller.signal)).resolves.toEqual({
      options: [{ value: "Web", label: "Web" }],
      hasMore: true,
    });
    expect(listDashboardFilterValues).toHaveBeenCalledWith({
      dashboardId: "d1",
      filterId: filter.id,
      dateRange: "last_7_days",
      picks: { other: ["x"] },
      search: "we",
      signal: controller.signal,
    });
  });

  test("an empty search and no date range send neither", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({ values: [], hasMore: false } as never);
    await property({}, null).loadOptions!("");
    expect(listDashboardFilterValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateRange: undefined, search: undefined })
    );
  });
});

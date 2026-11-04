import { describe, expect, test, vi } from "vitest";
import { listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardFilterState } from "./dashboard-filter-state";
import { getDashboardFieldValueProperty } from "./dashboard-filter-values";

vi.mock("@/modules/ee/analysis/lib/api-client", () => ({ listDashboardFilterValues: vi.fn() }));

const FIELD = "FeedbackRecords.sourceType";
const OTHER: TDashboardFilterState = {
  field: "FeedbackRecords.metadataDevice",
  operator: "equals",
  values: ["x"],
};

const property = (
  otherFilters: TDashboardFilterState[] = [],
  dateRange: "last_7_days" | null = "last_7_days"
) =>
  getDashboardFieldValueProperty({
    dashboardId: "d1",
    field: FIELD,
    label: "Source",
    otherFilters,
    dateRange,
  });

const startsWith = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((part, index) => Object.is(part, key[index]));

describe("getDashboardFieldValueProperty", () => {
  test("is the field itself, as a categorical property", () => {
    expect(property()).toMatchObject({ id: FIELD, label: "Source", valueType: "enum" });
  });

  test("caches each search under the chart data keys, so a chart edit refreshes the list", () => {
    expect(startsWith(chartKeys.allData(), property().queryKey!("we"))).toBe(true);
  });

  test("keys the list by the field, the other filters, the date range and the search", () => {
    const key = property([OTHER]).queryKey!("we");
    expect(key).toContainEqual({
      dateRange: "last_7_days",
      filters: [OTHER],
      search: "we",
      field: FIELD,
      operator: "equals",
    });
    expect(property([{ ...OTHER, values: ["y"] }]).queryKey!("we")).not.toEqual(key);
    expect(property([OTHER], null).queryKey!("we")).not.toEqual(key);
    expect(property([OTHER]).queryKey!("w")).not.toEqual(key);
  });

  test("loads through the dashboard with the abort signal, and returns a page", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({
      values: [{ value: "Web", count: 3 }],
      hasMore: true,
    } as never);
    const controller = new AbortController();

    await expect(property([OTHER]).loadOptions!("we", controller.signal)).resolves.toEqual({
      options: [{ value: "Web", label: "Web" }],
      hasMore: true,
    });
    expect(listDashboardFilterValues).toHaveBeenCalledWith({
      dashboardId: "d1",
      field: FIELD,
      operator: "equals",
      dateRange: "last_7_days",
      filters: [OTHER],
      search: "we",
      signal: controller.signal,
    });
  });

  test("an empty search and no date range send neither", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({ values: [], hasMore: false } as never);
    await property([], null).loadOptions!("");
    expect(listDashboardFilterValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateRange: undefined, search: undefined })
    );
  });
});

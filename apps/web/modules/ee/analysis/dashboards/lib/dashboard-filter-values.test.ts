import { describe, expect, test, vi } from "vitest";
import { listDashboardFilterValues } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardFilterState } from "./dashboard-filter-state";
import { getDashboardFieldAvailableValues, getDashboardFieldValueProperty } from "./dashboard-filter-values";
import { NO_VALUE_PICK } from "./dashboard-filters";

vi.mock("@/modules/ee/analysis/lib/api-client", () => ({ listDashboardFilterValues: vi.fn() }));

const FIELD = "FeedbackRecords.sourceType";
const OTHER: TDashboardFilterState = {
  field: "FeedbackRecords.metadataDevice",
  operator: "equals",
  values: ["x"],
};

const NO_VALUE = { value: NO_VALUE_PICK, label: "(No value)" };

const property = (
  otherFilters: TDashboardFilterState[] = [],
  dateRange: "last_7_days" | null = "last_7_days"
) =>
  getDashboardFieldValueProperty({
    dashboardId: "d1",
    field: FIELD,
    label: "Source",
    noValueOption: NO_VALUE,
    otherFilters,
    dateRange,
  });

const startsWith = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((part, index) => Object.is(part, key[index]));

describe("getDashboardFieldValueProperty", () => {
  test("is the field itself, as a categorical property", () => {
    expect(property()).toMatchObject({ id: FIELD, label: "Source", valueType: "enum", options: [NO_VALUE] });
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

describe("the (No value) option", () => {
  test("comes first when there is no search, or one its label holds", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({
      values: [{ value: "Web", count: 3 }],
      hasMore: false,
    } as never);
    expect((await property().loadOptions!("")).options).toEqual([NO_VALUE, { value: "Web", label: "Web" }]);
    expect((await property().loadOptions!("no v")).options[0]).toEqual(NO_VALUE);
  });

  test("is left out when no record on the charts has a value, so the list reads as empty", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({ values: [], hasMore: false } as never);
    expect((await property().loadOptions!("")).options).toEqual([]);
  });
});

describe("getDashboardFieldAvailableValues", () => {
  const available = () =>
    getDashboardFieldAvailableValues({
      dashboardId: "d1",
      field: "FeedbackRecords.sentiment",
      otherFilters: [OTHER],
      dateRange: null,
      emptyHint: "none yet",
      narrowedHint: "none here",
    });

  test("is cached beside the value list, under the chart data keys", () => {
    const key = available().queryKey;
    expect(startsWith(chartKeys.allData(), key)).toBe(true);
    expect(key.at(-1)).toBe("available");
  });

  test("lists the values that occur, and (No value) with them", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({
      values: [{ value: "positive" }],
      hasMore: false,
    } as never);
    await expect(available().load()).resolves.toEqual({ values: ["positive", NO_VALUE_PICK] });
    expect(listDashboardFilterValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ field: "FeedbackRecords.sentiment", filters: [OTHER] })
    );
    expect(vi.mocked(listDashboardFilterValues).mock.lastCall?.[0]).not.toHaveProperty("search");
  });

  test("is empty with the field's own hint when no value occurs anywhere", async () => {
    vi.mocked(listDashboardFilterValues).mockResolvedValue({ values: [], hasMore: false } as never);
    await expect(available().load()).resolves.toEqual({ values: [], emptyHint: undefined });
    expect(vi.mocked(listDashboardFilterValues).mock.lastCall?.[0]).toMatchObject({ filters: [] });
  });

  test("says the filters or dates leave none when values occur outside them", async () => {
    vi.mocked(listDashboardFilterValues)
      .mockResolvedValueOnce({ values: [], hasMore: false } as never)
      .mockResolvedValueOnce({ values: [{ value: "positive" }], hasMore: false } as never);
    await expect(available().load()).resolves.toEqual({ values: [], emptyHint: "none here" });
  });

  test("asks only once when nothing narrows the list", async () => {
    vi.mocked(listDashboardFilterValues).mockClear();
    vi.mocked(listDashboardFilterValues).mockResolvedValue({ values: [], hasMore: false } as never);
    const unnarrowed = getDashboardFieldAvailableValues({
      dashboardId: "d1",
      field: "FeedbackRecords.sentiment",
      otherFilters: [],
      dateRange: null,
      emptyHint: "none yet",
      narrowedHint: "none here",
    });
    await expect(unnarrowed.load()).resolves.toEqual({ values: [] });
    expect(listDashboardFilterValues).toHaveBeenCalledTimes(1);
  });
});

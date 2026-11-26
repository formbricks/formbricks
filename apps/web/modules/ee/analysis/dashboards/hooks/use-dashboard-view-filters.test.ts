/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { writeStoredDateFilter } from "../lib/dashboard-date-filter";
import { type TDashboardFilterState, writeStoredFilters } from "../lib/dashboard-filter-state";
import { MAX_DASHBOARD_FILTERS } from "../lib/dashboard-filters";
import { useDashboardViewFilters } from "./use-dashboard-view-filters";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../lib/dashboard-date-filter", async (importActual) => ({
  ...(await importActual<typeof import("../lib/dashboard-date-filter")>()),
  writeStoredDateFilter: vi.fn(),
}));

vi.mock("../lib/dashboard-filter-state", async (importActual) => ({
  ...(await importActual<typeof import("../lib/dashboard-filter-state")>()),
  writeStoredFilters: vi.fn(),
}));

const FIELDS: Record<string, string> = {
  country: "FeedbackRecords.sourceName",
  city: "FeedbackRecords.valueText",
};

const filter = (name: string, values = ["x"]): TDashboardFilterState => ({
  field: FIELDS[name] ?? "FeedbackRecords.sourceName",
  operator: "equals",
  values,
});

const setup = ({ isViewingAs = false, search = "" } = {}) => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as never);
  return renderHook(() =>
    useDashboardViewFilters({
      dashboardId: "d1",
      storedDateFilter: { type: "all-time" },
      storedFilters: [filter("country")],
      isViewingAs,
    })
  );
};

describe("useDashboardViewFilters", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/workspaces/w1/dashboards/d1");
    vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("starts from what this viewer last chose here", () => {
    const { result } = setup();
    expect(result.current.dateFilter).toEqual({ type: "all-time" });
    expect(result.current.filters).toEqual([filter("country")]);
  });

  test("a date range pinned in the URL wins over the remembered one", () => {
    const { result } = setup({ search: "dateRange=custom&dateRangeFrom=2026-01-01&dateRangeTo=2026-01-31" });
    expect(result.current.dateFilter).toEqual({ type: "custom", range: ["2026-01-01", "2026-01-31"] });
  });

  test("remembers a date range and pins it in the URL", () => {
    const { result } = setup();
    act(() => result.current.handleDateFilterChange({ type: "preset", value: "last7Days" }));
    expect(writeStoredDateFilter).toHaveBeenCalledWith("d1", { type: "preset", value: "last7Days" });
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      "/workspaces/w1/dashboards/d1?dateRange=last7Days"
    );
  });

  test("clearing the date range leaves the bare path", () => {
    const { result } = setup({ search: "dateRange=all+time" });
    act(() => result.current.handleDateFilterChange(null));
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/workspaces/w1/dashboards/d1");
  });

  test("viewing as someone never replaces the viewer's own remembered choices", () => {
    const { result } = setup({ isViewingAs: true });
    act(() => result.current.handleDateFilterChange({ type: "all-time" }));
    act(() => result.current.handleFiltersChange([filter("city")]));
    expect(writeStoredDateFilter).not.toHaveBeenCalled();
    expect(writeStoredFilters).not.toHaveBeenCalled();
    expect(result.current.filters).toEqual([filter("city")]);
  });

  test("remembers the filters and applies them", () => {
    const { result } = setup();
    act(() => result.current.handleFiltersChange([filter("city")]));
    expect(writeStoredFilters).toHaveBeenCalledWith("d1", [filter("city")]);
    expect(result.current.filters).toEqual([filter("city")]);
    expect(window.history.pushState).toHaveBeenCalled();
  });

  test("refuses more filters than a dashboard takes", () => {
    const { result } = setup();
    const tooMany = Array.from({ length: MAX_DASHBOARD_FILTERS + 1 }, (_, index) =>
      filter("country", [`v${index}`])
    );
    act(() => result.current.handleFiltersChange(tooMany));
    expect(toast.error).toHaveBeenCalledWith("workspace.analysis.dashboards.filter_limit_reached");
    expect(result.current.filters).toEqual([filter("country")]);
  });

  test("refuses filter values too long to travel in a chart read's URL", () => {
    const { result } = setup();
    act(() => result.current.handleFiltersChange([filter("city", ["x".repeat(20_000)])]));
    expect(toast.error).toHaveBeenCalledWith("workspace.analysis.dashboards.filter_picks_too_long");
    expect(writeStoredFilters).not.toHaveBeenCalled();
  });
});

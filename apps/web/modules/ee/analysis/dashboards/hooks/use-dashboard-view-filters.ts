"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DATE_FILTER_FROM_PARAM,
  DATE_FILTER_PARAM,
  DATE_FILTER_TO_PARAM,
  type TDashboardDateFilter,
  parseDashboardDateFilter,
  toChartDateRange,
  writeStoredDateFilter,
} from "../lib/dashboard-date-filter";
import {
  type TDashboardFilterState,
  exceedsFiltersBudget,
  keepValidFilters,
  readFiltersFromUrl,
  writeFiltersToUrl,
  writeStoredFilters,
} from "../lib/dashboard-filter-state";
import { MAX_DASHBOARD_FILTERS } from "../lib/dashboard-filters";

/**
 * The date range and filters this person views the dashboard with. A choice pinned in the URL (a shared
 * link, back/forward) wins; otherwise the one this viewer last made here, seeded from the cookie so the
 * first fetch is already filtered. A pinned URL param is intentionally NOT written back to the cookie, so
 * opening a shared link never overwrites the viewer's own saved preference.
 */
export const useDashboardViewFilters = ({
  dashboardId,
  storedDateFilter,
  storedFilters,
  isViewingAs,
}: Readonly<{
  dashboardId: string;
  storedDateFilter: TDashboardDateFilter | null;
  storedFilters: TDashboardFilterState[];
  /** Viewing as someone is a preview: its choices never replace the viewer's own remembered ones. */
  isViewingAs: boolean;
}>) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [chosenDateFilter, setChosenDateFilter] = useState(storedDateFilter);
  const urlDateFilter = useMemo(
    () => parseDashboardDateFilter(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );
  const dateFilter = urlDateFilter ?? chosenDateFilter;
  // Stable across renders for the same filter, so the memoized widgets do not re-render on every one.
  const dateRangeKey = JSON.stringify(toChartDateRange(dateFilter));
  const dateRange = useMemo(() => JSON.parse(dateRangeKey) as TChartDateRangeInput | null, [dateRangeKey]);

  // The filters follow the date's rule: pinned in the URL wins, otherwise the ones this person last set here.
  // A remembered value stays applied even where it no longer occurs.
  const [chosenFilters, setChosenFilters] = useState(storedFilters);
  const urlFilters = useMemo(
    () => readFiltersFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const filtersKey = JSON.stringify(urlFilters ?? chosenFilters);
  const filters = useMemo(() => JSON.parse(filtersKey) as TDashboardFilterState[], [filtersKey]);

  const applyDateFilterToUrl = useCallback(
    (filter: TDashboardDateFilter | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(DATE_FILTER_PARAM);
      params.delete(DATE_FILTER_FROM_PARAM);
      params.delete(DATE_FILTER_TO_PARAM);

      if (filter?.type === "all-time") {
        params.set(DATE_FILTER_PARAM, ALL_TIME_VALUE);
      } else if (filter?.type === "preset") {
        params.set(DATE_FILTER_PARAM, filter.value);
      } else if (filter?.type === "custom") {
        params.set(DATE_FILTER_PARAM, CUSTOM_VALUE);
        params.set(DATE_FILTER_FROM_PARAM, filter.range[0]);
        params.set(DATE_FILTER_TO_PARAM, filter.range[1]);
      }

      // A shallow history entry: the widgets refetch through their queries, so the page itself has
      // nothing to re-render on the server. Next.js keeps `useSearchParams` in step with it.
      const queryString = params.toString();
      window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, searchParams]
  );

  const handleDateFilterChange = useCallback(
    (filter: TDashboardDateFilter | null) => {
      // Persist the choice (cookie) so it survives across sessions and seeds the next visit's first
      // fetch, then reflect it in the URL so the view can be shared.
      if (!isViewingAs) writeStoredDateFilter(dashboardId, filter);
      setChosenDateFilter(filter);
      applyDateFilterToUrl(filter);
    },
    [applyDateFilterToUrl, dashboardId, isViewingAs]
  );

  // Remember the filters (cookie) for the next visit, then pin them in the URL so the view can be shared.
  const handleFiltersChange = useCallback(
    (next: TDashboardFilterState[]) => {
      const kept = keepValidFilters(next);
      if (kept.length >= MAX_DASHBOARD_FILTERS && next.length > MAX_DASHBOARD_FILTERS) {
        toast.error(t("workspace.analysis.dashboards.filter_limit_reached", { max: MAX_DASHBOARD_FILTERS }));
        return;
      }
      // The filters travel in every chart read's URL, so their values are bounded as the API bounds them.
      if (exceedsFiltersBudget(kept)) {
        toast.error(t("workspace.analysis.dashboards.filter_picks_too_long"));
        return;
      }
      if (!isViewingAs) writeStoredFilters(dashboardId, kept);
      setChosenFilters(kept);
      const params = writeFiltersToUrl(new URLSearchParams(searchParams.toString()), kept);
      const queryString = params.toString();
      window.history.pushState(null, "", queryString ? `${pathname}?${queryString}` : pathname);
    },
    [dashboardId, pathname, searchParams, t, isViewingAs]
  );

  return { dateFilter, dateRange, filters, handleDateFilterChange, handleFiltersChange };
};

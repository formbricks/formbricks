import type { InfiniteData } from "@tanstack/react-query";
import type {
  TAppChart,
  TAppDashboardListItem,
  TChartDateRangeInput,
  TChartListFilters,
  TDashboardListFilters,
  TV3ListPage,
} from "./api-client";

/** Query keys for the analysis module. Invalidate by the broad keys after a write; read by the narrow. */
export const chartKeys = {
  all: ["charts"] as const,
  lists: () => [...chartKeys.all, "list"] as const,
  list: (input: { workspaceId: string; limit: number } & TChartListFilters) =>
    [...chartKeys.lists(), input] as const,
  details: () => [...chartKeys.all, "detail"] as const,
  detail: (chartId: string) => [...chartKeys.details(), chartId] as const,
  /** Every chart's data; a chart edit invalidates the lot, since dashboards render it in many places. */
  allData: () => [...chartKeys.all, "data"] as const,
  data: (chartId: string, dateRange: TChartDateRangeInput | null) =>
    [...chartKeys.allData(), chartId, dateRange] as const,
};

export const dashboardKeys = {
  all: ["dashboards"] as const,
  lists: () => [...dashboardKeys.all, "list"] as const,
  list: (input: { workspaceId: string; limit: number } & TDashboardListFilters) =>
    [...dashboardKeys.lists(), input] as const,
  /** The workspace's dashboards as a picker offers them: one plain page, not an infinite list. */
  options: (workspaceId: string) => [...dashboardKeys.lists(), "options", workspaceId] as const,
  details: () => [...dashboardKeys.all, "detail"] as const,
  detail: (dashboardId: string) => [...dashboardKeys.details(), dashboardId] as const,
};

export const flattenPages = <T>(data?: InfiniteData<TV3ListPage<T>>): T[] =>
  data?.pages.flatMap((page) => page.data) ?? [];

export type TChartListPage = TV3ListPage<TAppChart>;
export type TDashboardListPage = TV3ListPage<TAppDashboardListItem>;

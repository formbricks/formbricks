import type { InfiniteData } from "@tanstack/react-query";
import type { TAppChart, TChartListFilters, TV3ListPage } from "./api-client";

/** Query keys for the analysis module. Invalidate by the broad keys after a write; read by the narrow. */
export const chartKeys = {
  all: ["charts"] as const,
  lists: () => [...chartKeys.all, "list"] as const,
  list: (input: { workspaceId: string; limit: number } & TChartListFilters) =>
    [...chartKeys.lists(), input] as const,
  details: () => [...chartKeys.all, "detail"] as const,
  detail: (chartId: string) => [...chartKeys.details(), chartId] as const,
};

export const flattenPages = <T>(data?: InfiniteData<TV3ListPage<T>>): T[] =>
  data?.pages.flatMap((page) => page.data) ?? [];

export type TChartListPage = TV3ListPage<TAppChart>;

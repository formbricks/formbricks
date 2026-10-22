import type { TV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

/**
 * The app's client for the public chart and dashboard API (ADR 0002: the app goes through the same
 * `/api/v3` contract agents use). Every function throws the parsed problem (`V3ApiError`) on a non-2xx,
 * so callers branch on `code` rather than on prose.
 */

const CHARTS_PATH = "/api/v3/charts";

/** Bounds a write so a stalled request cannot leave a dialog's spinner running forever. */
export const MUTATION_TIMEOUT_MS = 15_000;

export type TV3ListPage<T> = { data: T[]; meta: { limit: number; nextCursor: string | null } };

/**
 * A chart as the app's components use it. The public resource names its Feedback Dataset `datasetId`;
 * the builder and the rest of the analysis module still call it `feedbackDirectoryId`, so the translation
 * happens once, here at the boundary, instead of in every component.
 */
export type TAppChart = TChartWithCreator & { dashboards: TV3ChartResource["dashboards"] };

export const toAppChart = (resource: TV3ChartResource): TAppChart => ({
  id: resource.id,
  name: resource.name,
  type: resource.type,
  query: resource.query as TAppChart["query"],
  config: resource.config as TAppChart["config"],
  feedbackDirectoryId: resource.datasetId,
  createdAt: new Date(resource.createdAt),
  updatedAt: new Date(resource.updatedAt),
  creator: resource.creator,
  dashboards: resource.dashboards,
});

const readData = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: T }).data;
};

export type TChartListFilters = { nameContains?: string; datasetId?: string };

export const buildChartListSearchParams = ({
  workspaceId,
  limit,
  cursor,
  filters,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TChartListFilters;
}): URLSearchParams => {
  const searchParams = new URLSearchParams({ workspaceId, limit: String(limit) });
  if (cursor) searchParams.set("cursor", cursor);

  const nameContains = filters?.nameContains?.trim();
  if (nameContains) searchParams.set("filter[name][contains]", nameContains);
  if (filters?.datasetId) searchParams.set("filter[datasetId][eq]", filters.datasetId);

  return searchParams;
};

export const listCharts = async ({
  signal,
  ...input
}: Parameters<typeof buildChartListSearchParams>[0] & { signal?: AbortSignal }): Promise<
  TV3ListPage<TAppChart>
> => {
  const response = await fetch(`${CHARTS_PATH}?${buildChartListSearchParams(input).toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);

  const page = (await response.json()) as TV3ListPage<TV3ChartResource>;
  return { data: page.data.map(toAppChart), meta: page.meta };
};

export const getChart = async (chartId: string, signal?: AbortSignal): Promise<TAppChart> =>
  toAppChart(
    await readData<TV3ChartResource>(
      await fetch(`${CHARTS_PATH}/${encodeURIComponent(chartId)}`, { cache: "no-store", signal })
    )
  );

import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartData, TV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TChartDataRow, TChartType, TChartWithCreator } from "@/modules/ee/analysis/types/analysis";

/**
 * The app's client for the public chart and dashboard API (ADR 0002: the app goes through the same
 * `/api/v3` contract agents use). Every function throws the parsed problem (`V3ApiError`) on a non-2xx,
 * so callers branch on `code` rather than on prose.
 */

const CHARTS_PATH = "/api/v3/charts";
const JSON_HEADERS = { "Content-Type": "application/json" };

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

/** A chart query's result as the renderers take it. */
export type TAppChartData = {
  rows: TChartDataRow[];
  optionLabels: Record<string, string>;
  fieldLabels: Record<string, string>;
  /** The query as it ran, after option grouping: what the rows' keys follow. */
  query: TChartQuery;
};

const toAppChartData = (data: TV3ChartData): TAppChartData => ({
  rows: data.rows,
  optionLabels: data.optionLabels,
  fieldLabels: data.fieldLabels,
  query: data.query as TChartQuery,
});

/** A date range to read a chart for: a preset, `all-time`, or two ISO calendar dates. */
export type TChartDateRangeInput = string | { from: string; to: string };

/** Run an unsaved chart. Not a mutation — it saves nothing — so it takes the caller's abort signal. */
export const previewChart = async ({
  signal,
  ...body
}: {
  workspaceId: string;
  datasetId: string;
  type: TChartType;
  query: TChartQuery;
  dateRange?: TChartDateRangeInput;
  signal?: AbortSignal;
}): Promise<TAppChartData> =>
  toAppChartData(
    await readData<TV3ChartData>(
      await fetch(`${CHARTS_PATH}/preview`, {
        method: "POST",
        cache: "no-store",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
        signal,
      })
    )
  );

/**
 * The message to show for a failed chart call: the problem's own detail, followed by the first problem
 * it names when the query was refused — "The chart query is not valid" alone tells a user nothing.
 */
export const getChartApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof V3ApiError))
    return error instanceof Error && error.message ? error.message : fallback;
  const firstReason = error.invalid_params?.[0]?.reason;
  return firstReason ? `${error.detail} ${firstReason}` : error.detail || fallback;
};

const sendJson = (method: "POST" | "PATCH" | "PUT", path: string, body: unknown): Promise<Response> =>
  fetch(path, {
    method,
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

export type TChartWriteInput = {
  name: string;
  type: TChartType;
  query: TChartQuery;
  config: TChartConfig;
};

export const createChart = async ({
  workspaceId,
  datasetId,
  ...chart
}: TChartWriteInput & { workspaceId: string; datasetId: string }): Promise<TAppChart> =>
  toAppChart(
    await readData<TV3ChartResource>(
      await sendJson("POST", CHARTS_PATH, { workspaceId, datasetId, ...chart })
    )
  );

export const updateChart = async (chartId: string, update: Partial<TChartWriteInput>): Promise<TAppChart> =>
  toAppChart(
    await readData<TV3ChartResource>(
      await sendJson("PATCH", `${CHARTS_PATH}/${encodeURIComponent(chartId)}`, update)
    )
  );

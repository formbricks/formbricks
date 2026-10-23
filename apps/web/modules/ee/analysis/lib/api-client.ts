import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartData, TV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import type {
  TV3DashboardListItem,
  TV3DashboardResource,
  TV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/resources";
import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";
import type {
  AnalyticsResponse,
  TChartDataRow,
  TChartType,
  TChartWithCreator,
  TDashboardWidget,
} from "@/modules/ee/analysis/types/analysis";

/**
 * The app's client for the public chart and dashboard API (ADR 0002: the app goes through the same
 * `/api/v3` contract agents use). Every function throws the parsed problem (`V3ApiError`) on a non-2xx,
 * so callers branch on `code` rather than on prose.
 */

const CHARTS_PATH = "/api/v3/charts";
const DASHBOARDS_PATH = "/api/v3/dashboards";
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
  /** Absent rather than empty, as the renderers expect: an empty map would still read as "present". */
  optionLabels?: Record<string, string>;
  fieldLabels?: Record<string, string>;
  /** The query as it ran, after option grouping: what the rows' keys follow. */
  query: TChartQuery;
};

const presentOrUndefined = (labels: Record<string, string>) =>
  Object.keys(labels).length > 0 ? labels : undefined;

const toAppChartData = (data: TV3ChartData): TAppChartData => ({
  rows: data.rows,
  optionLabels: presentOrUndefined(data.optionLabels),
  fieldLabels: presentOrUndefined(data.fieldLabels),
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

/** A date range as the data route's query string spells it. */
const dateRangeSearchParams = (dateRange?: TChartDateRangeInput): URLSearchParams => {
  if (dateRange === undefined) return new URLSearchParams();
  return typeof dateRange === "string"
    ? new URLSearchParams({ dateRange })
    : new URLSearchParams({ from: dateRange.from, to: dateRange.to });
};

/** A saved chart's rows, for its own date range or a requested one that replaces it. */
export const getChartData = async ({
  chartId,
  dateRange,
  signal,
}: {
  chartId: string;
  dateRange?: TChartDateRangeInput;
  signal?: AbortSignal;
}): Promise<TAppChartData> => {
  const search = dateRangeSearchParams(dateRange).toString();
  const base = `${CHARTS_PATH}/${encodeURIComponent(chartId)}/data`;
  const path = search ? `${base}?${search}` : base;
  return toAppChartData(await readData<TV3ChartData>(await fetch(path, { cache: "no-store", signal })));
};

/** A field's stored value, with the question type when the field is the question label. */
export type TChartFieldValue = { value: string; fieldType?: string };

/** Up to 100 distinct stored values of a lookup field, optionally narrowed by `search`. */
export const listChartFieldValues = async ({
  workspaceId,
  datasetId,
  field,
  search,
  signal,
}: {
  workspaceId: string;
  datasetId: string;
  field: string;
  search?: string;
  signal?: AbortSignal;
}): Promise<TChartFieldValue[]> => {
  const params = new URLSearchParams({ workspaceId, datasetId });
  if (search) params.set("search", search);
  const path = `${CHARTS_PATH}/fields/${encodeURIComponent(field)}/values?${params.toString()}`;
  return readData<TChartFieldValue[]>(await fetch(path, { cache: "no-store", signal }));
};

/** A dashboard row as the list shows it. */
export type TAppDashboardListItem = Omit<TV3DashboardListItem, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

const toAppDashboardListItem = (item: TV3DashboardListItem): TAppDashboardListItem => ({
  ...item,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
});

/**
 * A dashboard as the page renders it. `updatedAt` stays the server's ISO string: it is what a full save
 * sends back for the stale-check, and a round trip through `Date` would be one more place to lose it.
 */
export type TAppDashboard = Pick<TV3DashboardResource, "id" | "workspaceId" | "name" | "updatedAt"> & {
  widgets: TDashboardWidget[];
};

const toAppDashboardWidget = (dashboardId: string, widget: TV3DashboardWidget): TDashboardWidget => ({
  id: widget.id,
  dashboardId,
  chartId: widget.chartId,
  layout: widget.layout,
  order: widget.order,
  chart: toAppChart(widget.chart),
});

export const toAppDashboard = (resource: TV3DashboardResource): TAppDashboard => ({
  id: resource.id,
  workspaceId: resource.workspaceId,
  name: resource.name,
  updatedAt: resource.updatedAt,
  widgets: resource.widgets.map((widget) => toAppDashboardWidget(resource.id, widget)),
});

export type TDashboardListFilters = { nameContains?: string; chartId?: string };

export const listDashboards = async ({
  workspaceId,
  limit,
  cursor,
  filters,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TDashboardListFilters;
  signal?: AbortSignal;
}): Promise<TV3ListPage<TAppDashboardListItem>> => {
  const params = new URLSearchParams({ workspaceId, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const nameContains = filters?.nameContains?.trim();
  if (nameContains) params.set("filter[name][contains]", nameContains);
  if (filters?.chartId) params.set("filter[chartId][eq]", filters.chartId);

  const response = await fetch(`${DASHBOARDS_PATH}?${params.toString()}`, { cache: "no-store", signal });
  if (!response.ok) throw await parseV3ApiError(response);

  const page = (await response.json()) as TV3ListPage<TV3DashboardListItem>;
  return { data: page.data.map(toAppDashboardListItem), meta: page.meta };
};

export const getDashboard = async (dashboardId: string, signal?: AbortSignal): Promise<TAppDashboard> =>
  toAppDashboard(
    await readData<TV3DashboardResource>(
      await fetch(`${DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}`, { cache: "no-store", signal })
    )
  );

const dashboardPath = (dashboardId: string) => `${DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}`;

export const createDashboard = async ({
  workspaceId,
  name,
}: {
  workspaceId: string;
  name: string;
}): Promise<TAppDashboard> =>
  toAppDashboard(
    await readData<TV3DashboardResource>(await sendJson("POST", DASHBOARDS_PATH, { workspaceId, name }))
  );

/**
 * Saves the whole edited dashboard — its name and every widget's place — in one call. `updatedAt` is the
 * version the edit started from; if the dashboard changed since, nothing is saved and the call throws
 * the 409 `isStaleDashboardError` recognises. A widget left out is removed.
 */
export const replaceDashboard = async (
  dashboardId: string,
  dashboard: {
    name: string;
    updatedAt: string;
    widgets: { widgetId: string; layout: TDashboardWidget["layout"]; order: number }[];
  }
): Promise<TAppDashboard> =>
  toAppDashboard(
    await readData<TV3DashboardResource>(await sendJson("PUT", dashboardPath(dashboardId), dashboard))
  );

/** The dashboard changed after the caller read it, so a save carrying the old `updatedAt` was refused. */
export const isStaleDashboardError = (error: unknown): boolean =>
  error instanceof V3ApiError && error.status === 409 && typeof error.details?.currentUpdatedAt === "string";

/** A copy whose widgets point at the same charts; without a `name` the server picks the "(copy)" one. */
export const duplicateDashboard = async (dashboardId: string, name?: string): Promise<TAppDashboard> =>
  toAppDashboard(
    await readData<TV3DashboardResource>(
      await sendJson("POST", `${dashboardPath(dashboardId)}/duplicate`, name === undefined ? {} : { name })
    )
  );

const sendDelete = async (path: string): Promise<void> => {
  const response = await fetch(path, {
    method: "DELETE",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
};

/** Deletes the dashboard and its widgets; the charts stay. */
export const deleteDashboard = (dashboardId: string): Promise<void> => sendDelete(dashboardPath(dashboardId));

const widgetsPath = (dashboardId: string) => `${dashboardPath(dashboardId)}/widgets`;

/** Puts a chart on a dashboard; without a `layout` it lands in the first open slot. */
export const addDashboardWidget = async (
  dashboardId: string,
  widget: { chartId: string; layout?: TDashboardWidget["layout"] }
): Promise<TDashboardWidget> =>
  toAppDashboardWidget(
    dashboardId,
    await readData<TV3DashboardWidget>(await sendJson("POST", widgetsPath(dashboardId), widget))
  );

/** Takes a widget off its dashboard; the chart stays. */
export const removeDashboardWidget = (dashboardId: string, widgetId: string): Promise<void> =>
  sendDelete(`${widgetsPath(dashboardId)}/${encodeURIComponent(widgetId)}`);

/**
 * Places something at `layout`, or in the first open slot if that spot was taken meanwhile (the server
 * refuses an overlap with 422): getting it onto the dashboard matters more than the exact position.
 */
const placeOrFirstOpenSlot = async <T>(
  layout: TDashboardWidget["layout"],
  place: (layout?: TDashboardWidget["layout"]) => Promise<T>
): Promise<T> => {
  try {
    return await place(layout);
  } catch (error) {
    if (error instanceof V3ApiError && error.status === 422) return place();
    throw error;
  }
};

/** Puts a removed widget's chart back where it was, or in the first open slot if that was taken. */
export const restoreDashboardWidget = (
  dashboardId: string,
  widget: Pick<TDashboardWidget, "chartId" | "layout">
): Promise<TDashboardWidget> =>
  placeOrFirstOpenSlot(widget.layout, (layout) =>
    addDashboardWidget(dashboardId, { chartId: widget.chartId, layout })
  );

/**
 * Copies a chart. With a `dashboardId` the copy goes on that dashboard in the same call — at `layout`,
 * or in the first open slot if that was taken meanwhile — so a failure never leaves a stray copy.
 */
export const duplicateChart = async (
  chartId: string,
  placement?: { dashboardId: string; layout: TDashboardWidget["layout"] }
): Promise<TAppChart> => {
  const send = async (body: Record<string, unknown>) =>
    toAppChart(
      await readData<TV3ChartResource>(
        await sendJson("POST", `${CHARTS_PATH}/${encodeURIComponent(chartId)}/duplicate`, body)
      )
    );
  if (!placement) return send({});
  return placeOrFirstOpenSlot(placement.layout, (layout) =>
    send({ dashboardId: placement.dashboardId, ...(layout ? { layout } : {}) })
  );
};

/** Deletes a chart on no dashboard. A chart still on one is refused: see `chartInUseDashboards`. */
export const deleteChart = (chartId: string): Promise<void> =>
  sendDelete(`${CHARTS_PATH}/${encodeURIComponent(chartId)}`);

/** The dashboards a refused chart delete names, or `null` when the error is anything else. */
export const chartInUseDashboards = (error: unknown): { id: string; name: string }[] | null => {
  if (!(error instanceof V3ApiError) || error.code !== "chart_in_use") return null;
  const dashboards = error.details?.dashboards;
  return Array.isArray(dashboards)
    ? dashboards.filter(
        (dashboard): dashboard is { id: string; name: string } =>
          typeof dashboard?.id === "string" && typeof dashboard?.name === "string"
      )
    : [];
};

/**
 * An unsaved chart for a prompt, from the app-only generation route. `signal` lets Stop abandon the
 * request as well as its result.
 */
export const generateChart = async ({
  workspaceId,
  datasetId,
  prompt,
  signal,
}: {
  workspaceId: string;
  datasetId: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<AnalyticsResponse> => {
  const response = await fetch("/api/internal/charts/generate", {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify({ workspaceId, datasetId, prompt }),
    signal,
  });
  return readData<AnalyticsResponse>(response);
};

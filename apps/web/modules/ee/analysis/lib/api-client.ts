import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import type { TV3ChartData, TV3ChartFieldCatalog, TV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import type {
  TV3DashboardChartData,
  TV3DashboardFilterFields,
  TV3DashboardFilterValues,
  TV3DashboardListItem,
  TV3DashboardResource,
  TV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/resources";
import {
  type TApiListPage,
  getApiData,
  getApiPage,
  sendApiRequest,
} from "@/modules/api/lib/internal-api-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  type TDashboardFilterState,
  appendFilterParams,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-state";
import type {
  TDashboardFilter,
  TLockedDashboardFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { DEFAULT_IMAGE_CONTENT } from "@/modules/ee/analysis/dashboards/lib/widget-blocks";
import type {
  AnalyticsResponse,
  TChartDataRow,
  TChartType,
  TChartWithCreator,
  TDashboardPage,
  TDashboardWidget,
} from "@/modules/ee/analysis/types/analysis";

/**
 * The app's client for the public chart and dashboard API (ADR 0002: the app goes through the same
 * `/api/v3` contract agents use). Requests go through the shared helpers (`internal-api-client`), so every
 * failure is a `V3ApiError` and callers branch on `code` rather than on prose.
 */

const CHARTS_PATH = "/api/v3/charts";
const DASHBOARDS_PATH = "/api/v3/dashboards";

/** The query parameter View as (ENG-7484) is carried in, on the dashboard page and on its reads. */
export const VIEW_AS_PARAM = "viewAs";

/**
 * The member an Owner or Manager is viewing the dashboard as, from the page's URL, or `null`. Only the
 * dashboard reads carry it; the server refuses it on anything else. Starting or stopping View as reloads
 * the page, so no read cached for one viewer is ever shown for another.
 */
export const getViewAsUserId = (): string | null =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(VIEW_AS_PARAM);

/** `url` with the page's View as member, if any. */
const withViewAs = (url: string): string => {
  const viewAs = getViewAsUserId();
  if (!viewAs) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${VIEW_AS_PARAM}=${encodeURIComponent(viewAs)}`;
};

/** A problem's `details` are typed `unknown`; the operations that set them put a JSON object there. */
const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type TV3ListPage<T> = TApiListPage<T>;

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
  query: resource.query,
  config: resource.config,
  feedbackDirectoryId: resource.datasetId,
  createdAt: new Date(resource.createdAt),
  updatedAt: new Date(resource.updatedAt),
  creator: resource.creator,
  dashboards: resource.dashboards,
});

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
  const page = await getApiPage<TV3ChartResource>(
    `${CHARTS_PATH}?${buildChartListSearchParams(input).toString()}`,
    { signal }
  );
  return { data: page.data.map(toAppChart), meta: page.meta };
};

export const getChart = async (chartId: string, signal?: AbortSignal): Promise<TAppChart> =>
  toAppChart(await getApiData<TV3ChartResource>(`${CHARTS_PATH}/${encodeURIComponent(chartId)}`, { signal }));

/** A chart query's result as the renderers take it. */
export type TAppChartData = {
  rows: TChartDataRow[];
  /** Absent rather than empty, as the renderers expect: an empty map would still read as "present". */
  optionLabels?: Record<string, string>;
  fieldLabels?: Record<string, string>;
  memberLabels?: Record<string, string>;
  /** The query as it ran, after option grouping: what the rows' keys follow. */
  query: TChartQuery;
};

const presentOrUndefined = (labels: Record<string, string> | undefined) =>
  labels && Object.keys(labels).length > 0 ? labels : undefined;

const toAppChartData = (data: TV3ChartData): TAppChartData => ({
  rows: data.rows,
  optionLabels: presentOrUndefined(data.optionLabels),
  fieldLabels: presentOrUndefined(data.fieldLabels),
  memberLabels: presentOrUndefined(data.memberLabels),
  query: data.query,
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
    await sendApiRequest<TV3ChartData>(`${CHARTS_PATH}/preview`, {
      method: "POST",
      body,
      timeoutMs: null,
      signal,
    })
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
    await sendApiRequest<TV3ChartResource>(CHARTS_PATH, {
      method: "POST",
      body: { workspaceId, datasetId, ...chart },
    })
  );

export const updateChart = async (chartId: string, update: Partial<TChartWriteInput>): Promise<TAppChart> =>
  toAppChart(
    await sendApiRequest<TV3ChartResource>(`${CHARTS_PATH}/${encodeURIComponent(chartId)}`, {
      method: "PATCH",
      body: update,
    })
  );

/** A date range as the data route's query string spells it. */
const dateRangeSearchParams = (dateRange?: TChartDateRangeInput): URLSearchParams => {
  if (dateRange === undefined) return new URLSearchParams();
  return typeof dateRange === "string"
    ? new URLSearchParams({ dateRange })
    : new URLSearchParams({ from: dateRange.from, to: dateRange.to });
};

/** A chart's rows read through its dashboard, and the picked filters its dataset cannot be narrowed by. */
export type TAppDashboardChartData = TAppChartData & {
  unfilterableFilters: TV3DashboardChartData["unfilterableFilters"];
};

/** The dashboard date range and filters a dashboard-bound read is set to. */
const dashboardReadParams = (
  dateRange: TChartDateRangeInput | undefined,
  filters: readonly TDashboardFilterState[] | undefined
): URLSearchParams => appendFilterParams(dateRangeSearchParams(dateRange), filters ?? []);

/**
 * A widget's rows through its dashboard (ADR-0002): the dashboard date range replaces the chart's own, and
 * each filter is ANDed onto its saved filters.
 */
export const getDashboardChartData = async ({
  dashboardId,
  chartId,
  dateRange,
  filters,
  signal,
}: {
  dashboardId: string;
  chartId: string;
  dateRange?: TChartDateRangeInput;
  filters?: readonly TDashboardFilterState[];
  signal?: AbortSignal;
}): Promise<TAppDashboardChartData> => {
  const search = dashboardReadParams(dateRange, filters).toString();
  const base = `${dashboardPath(dashboardId)}/charts/${encodeURIComponent(chartId)}/data`;
  const data = await getApiData<TV3DashboardChartData>(withViewAs(search ? `${base}?${search}` : base), {
    signal,
  });
  return { ...toAppChartData(data), unfilterableFilters: data.unfilterableFilters };
};

/**
 * Up to 100 values a field offers on a dashboard, narrowed by the date range, the `filters` already applied
 * and `search`. The field is asked as the first filter of the request, `f1`, with no values of its own.
 */
export const listDashboardFilterValues = async ({
  dashboardId,
  field,
  operator,
  dateRange,
  filters,
  search,
  signal,
}: {
  dashboardId: string;
  field: string;
  operator: TDashboardFilter["operator"];
  dateRange?: TChartDateRangeInput;
  filters?: readonly TDashboardFilterState[];
  search?: string;
  signal?: AbortSignal;
}): Promise<TV3DashboardFilterValues> => {
  const params = dashboardReadParams(dateRange, [{ field, operator, values: [] }, ...(filters ?? [])]);
  if (search) params.set("search", search);
  const query = params.toString();
  const base = `${dashboardPath(dashboardId)}/filters/f1/values`;
  return getApiData<TV3DashboardFilterValues>(withViewAs(query ? `${base}?${query}` : base), { signal });
};

/**
 * The embedded-data fields a filter on the dashboard can use: the keys of the Feedback Datasets its charts
 * read. A dashboard-bound read, so it answers a Dashboard viewer too, whom the field catalog refuses.
 */
export const listDashboardFilterFields = async (
  dashboardId: string,
  signal?: AbortSignal
): Promise<TV3DashboardFilterFields> =>
  getApiData<TV3DashboardFilterFields>(withViewAs(`${dashboardPath(dashboardId)}/filter-fields`), { signal });

/** A saved chart's rows, for its own date range or a requested one that narrows it. */
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
  return toAppChartData(await getApiData<TV3ChartData>(path, { signal }));
};

/** One Feedback Dataset's field catalog: the shared fields plus its embedded-data keys (ENG-6893). */
export const getChartFieldCatalog = async ({
  workspaceId,
  datasetId,
  signal,
}: {
  workspaceId: string;
  datasetId: string;
  signal?: AbortSignal;
}): Promise<TV3ChartFieldCatalog> => {
  const params = new URLSearchParams({ workspaceId, datasetId });
  return getApiData<TV3ChartFieldCatalog>(`${CHARTS_PATH}/fields?${params.toString()}`, { signal });
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
  return getApiData<TChartFieldValue[]>(path, { signal });
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
  filters: TLockedDashboardFilter[];
  /** In tab order. */
  pages: TDashboardPage[];
  widgets: TDashboardWidget[];
  /** What the reader's Dashboard Viewer access leaves them (ENG-7478); only on a dashboard read. */
  viewerAccess?: TV3DashboardResource["viewerAccess"];
};

/**
 * A widget as the page renders it, narrowed by kind. A chart widget whose chart did not come back (a row
 * the API could not read whole) is dropped by the caller rather than drawn without one.
 */
const toAppDashboardWidget = (dashboardId: string, widget: TV3DashboardWidget): TDashboardWidget | null => {
  const base = {
    id: widget.id,
    dashboardId,
    pageId: widget.pageId,
    layout: widget.layout,
    order: widget.order,
  };
  switch (widget.kind) {
    case "chart":
      return widget.chart && widget.chartId
        ? { ...base, kind: "chart", chartId: widget.chartId, chart: toAppChart(widget.chart), content: null }
        : null;
    case "image":
      return {
        ...base,
        kind: "image",
        chartId: null,
        chart: null,
        content: widget.content && "fit" in widget.content ? widget.content : { ...DEFAULT_IMAGE_CONTENT },
      };
    case "text":
      return {
        ...base,
        kind: "text",
        chartId: null,
        chart: null,
        content:
          widget.content && "headline" in widget.content ? widget.content : { headline: "", description: "" },
      };
    case "separator":
      return { ...base, kind: "separator", chartId: null, chart: null, content: null };
  }
};

const requireAppWidget = (dashboardId: string, widget: TV3DashboardWidget): TDashboardWidget => {
  const app = toAppDashboardWidget(dashboardId, widget);
  if (!app) throw new Error("The widget has no chart.");
  return app;
};

export const toAppDashboard = (resource: TV3DashboardResource): TAppDashboard => ({
  id: resource.id,
  workspaceId: resource.workspaceId,
  name: resource.name,
  updatedAt: resource.updatedAt,
  filters: resource.filters,
  pages: resource.pages,
  viewerAccess: resource.viewerAccess,
  widgets: resource.widgets.flatMap((widget) => {
    const app = toAppDashboardWidget(resource.id, widget);
    return app ? [app] : [];
  }),
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

  const page = await getApiPage<TV3DashboardListItem>(`${DASHBOARDS_PATH}?${params.toString()}`, { signal });
  return { data: page.data.map(toAppDashboardListItem), meta: page.meta };
};

export const getDashboard = async (dashboardId: string, signal?: AbortSignal): Promise<TAppDashboard> =>
  toAppDashboard(
    await getApiData<TV3DashboardResource>(
      withViewAs(`${DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}`),
      {
        signal,
      }
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
    await sendApiRequest<TV3DashboardResource>(DASHBOARDS_PATH, {
      method: "POST",
      body: { workspaceId, name },
    })
  );

/** A page as the whole-dashboard save sends it: an existing one by id, a new one by its draft key. */
export type TSavedPage = {
  pageId?: string;
  key?: string;
  name: string;
  order: number;
  teamIds?: string[] | null;
};

/** A widget as the whole-dashboard save sends it: an existing one by id, or a new one by kind. */
export type TSavedWidget = {
  widgetId?: string;
  kind?: TDashboardWidget["kind"];
  chartId?: string;
  pageId?: string;
  pageKey?: string;
  content?: TDashboardWidget["content"];
  layout: TDashboardWidget["layout"];
  order: number;
};

/**
 * Saves the whole edited dashboard — its name, pages, every widget's page, place and content, and its
 * filters — in one call. `expectedUpdatedAt` is the version the edit started from; if the dashboard
 * changed since, nothing is saved and the call throws the 409 `isStaleDashboardError` recognises. A
 * widget or page left out is removed; new pages and widgets are created.
 */
export const replaceDashboard = async (
  dashboardId: string,
  dashboard: {
    name: string;
    expectedUpdatedAt: string;
    filters?: TLockedDashboardFilter[];
    pages?: TSavedPage[];
    widgets: TSavedWidget[];
  }
): Promise<TAppDashboard> =>
  toAppDashboard(
    await sendApiRequest<TV3DashboardResource>(dashboardPath(dashboardId), { method: "PUT", body: dashboard })
  );

/** The dashboard changed after the caller read it, so a save expecting the old `updatedAt` was refused. */
export const isStaleDashboardError = (error: unknown): boolean =>
  error instanceof V3ApiError &&
  error.status === 409 &&
  isPlainRecord(error.details) &&
  typeof error.details.currentUpdatedAt === "string";

/** A copy whose widgets point at the same charts; without a `name` the server picks the "(copy)" one. */
export const duplicateDashboard = async (dashboardId: string, name?: string): Promise<TAppDashboard> =>
  toAppDashboard(
    await sendApiRequest<TV3DashboardResource>(`${dashboardPath(dashboardId)}/duplicate`, {
      method: "POST",
      body: name === undefined ? {} : { name },
    })
  );

const sendDelete = (path: string): Promise<void> => sendApiRequest<void>(path, { method: "DELETE" });

/** Deletes the dashboard and its widgets; the charts stay. */
export const deleteDashboard = (dashboardId: string): Promise<void> => sendDelete(dashboardPath(dashboardId));

const widgetsPath = (dashboardId: string) => `${dashboardPath(dashboardId)}/widgets`;

/**
 * Puts a chart on a dashboard page — the first page without `pageId`; without a `layout` it lands in the
 * first open slot.
 */
export const addDashboardWidget = async (
  dashboardId: string,
  widget: { chartId: string; pageId?: string; layout?: TDashboardWidget["layout"] }
): Promise<TDashboardWidget> =>
  requireAppWidget(
    dashboardId,
    await sendApiRequest<TV3DashboardWidget>(widgetsPath(dashboardId), { method: "POST", body: widget })
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

/** Puts a removed widget's chart back on its page where it was, or in the first open slot if that was taken. */
export const restoreDashboardWidget = (
  dashboardId: string,
  widget: { chartId: string; pageId: string; layout: TDashboardWidget["layout"] }
): Promise<TDashboardWidget> =>
  placeOrFirstOpenSlot(widget.layout, (layout) =>
    addDashboardWidget(dashboardId, { chartId: widget.chartId, pageId: widget.pageId, layout })
  );

/**
 * Copies a chart. With a `dashboardId` the copy goes on that dashboard's page `pageId` in the same call —
 * at `layout`, or in the first open slot if that was taken meanwhile — so a failure never leaves a stray copy.
 */
export const duplicateChart = async (
  chartId: string,
  placement?: { dashboardId: string; pageId?: string; layout: TDashboardWidget["layout"] }
): Promise<TAppChart> => {
  const send = async (body: Record<string, unknown>) =>
    toAppChart(
      await sendApiRequest<TV3ChartResource>(`${CHARTS_PATH}/${encodeURIComponent(chartId)}/duplicate`, {
        method: "POST",
        body,
      })
    );
  if (!placement) return send({});
  return placeOrFirstOpenSlot(placement.layout, (layout) =>
    send({
      dashboardId: placement.dashboardId,
      ...(placement.pageId ? { pageId: placement.pageId } : {}),
      ...(layout ? { layout } : {}),
    })
  );
};

const INTERNAL_DASHBOARDS_PATH = "/api/internal/dashboards";

/** What the Manage pages dialog needs: whether this person may limit pages, and the teams to show. */
export type TDashboardPageAccess = {
  canManageAccess: boolean;
  /** `selectable` false: a team a page is limited to that can no longer be added. */
  teams: { id: string; name: string; selectable: boolean }[];
};

export const getDashboardPageAccess = async (
  dashboardId: string,
  signal?: AbortSignal
): Promise<TDashboardPageAccess> =>
  getApiData<TDashboardPageAccess>(
    `${INTERNAL_DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}/page-access`,
    {
      signal,
    }
  );

/**
 * Uploads an image block's file as a private file of the dashboard's workspace and answers the `fileUrl`
 * the block then holds: the server presigns the upload, the browser sends the file straight to storage.
 */
export const uploadDashboardImage = async (dashboardId: string, file: File): Promise<string> => {
  const { signedUrl, presignedFields, fileUrl } = await sendApiRequest<{
    signedUrl: string;
    presignedFields: Record<string, string>;
    fileUrl: string;
  }>(`${INTERNAL_DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}/image-uploads`, {
    method: "POST",
    body: { fileName: file.name },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(presignedFields)) form.append(key, value);
  form.append("file", file);
  const upload = await fetch(signedUrl, { method: "POST", body: form });
  if (!upload.ok) throw new Error(`Upload failed with ${upload.status}`);
  return fileUrl;
};

/** Deletes a chart on no dashboard. A chart still on one is refused: see `chartInUseDashboards`. */
export const deleteChart = (chartId: string): Promise<void> =>
  sendDelete(`${CHARTS_PATH}/${encodeURIComponent(chartId)}`);

/** The dashboards a refused chart delete names, or `null` when the error is anything else. */
export const chartInUseDashboards = (error: unknown): { id: string; name: string }[] | null => {
  if (!(error instanceof V3ApiError) || error.code !== "chart_in_use") return null;
  const dashboards = isPlainRecord(error.details) ? error.details.dashboards : undefined;
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
}): Promise<AnalyticsResponse> =>
  sendApiRequest<AnalyticsResponse>("/api/internal/charts/generate", {
    method: "POST",
    body: { workspaceId, datasetId, prompt },
    // An AI call takes its time; the user's Stop is the bound, not a fixed timeout.
    timeoutMs: null,
    signal,
  });

/**
 * Name an imported (embedded-data) key across the workspace, or clear its name with an empty `label`.
 * Resolves to the stored name, `null` when the key shows as collected again.
 */
export const setEmbeddedFieldLabel = async ({
  workspaceId,
  key,
  label,
  expectedLabel,
}: {
  workspaceId: string;
  key: string;
  label: string;
  /** The name the editor saw (`null`: none); the server refuses with 409 if it changed since. */
  expectedLabel: string | null;
}): Promise<{ key: string; label: string | null }> =>
  sendApiRequest<{ key: string; label: string | null }>("/api/internal/embedded-field-labels", {
    method: "PUT",
    body: { workspaceId, key, label, expectedLabel },
  });

export type TDashboardAccessOverview = {
  organizationId: string;
  teams: {
    id: string;
    name: string;
    permission: "read" | "readWrite" | "manage";
    limitedDashboardCount: number | null;
    memberCount: number;
  }[];
  members: {
    userId: string;
    name: string;
    email: string;
    role: string;
    attributes: { label: string; values: string[] }[];
  }[];
};

/** Who opens the dashboard and whom View as offers (ENG-7484): Owners and Managers only. */
export const getDashboardAccessOverview = async (
  dashboardId: string,
  signal?: AbortSignal
): Promise<TDashboardAccessOverview> =>
  getApiData<TDashboardAccessOverview>(
    `${INTERNAL_DASHBOARDS_PATH}/${encodeURIComponent(dashboardId)}/access`,
    {
      signal,
    }
  );

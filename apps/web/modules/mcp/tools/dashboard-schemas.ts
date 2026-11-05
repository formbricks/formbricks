import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { refuseLayoutWithoutDashboard } from "@/app/api/v3/charts/lib/duplicate-schemas";
import {
  ZV3ChartData,
  ZV3ChartFieldCatalog,
  ZV3ChartFieldValue,
  ZV3ChartResource,
} from "@/app/api/v3/charts/lib/resources";
import { V3_NAME_MAX_LENGTH, ZV3ChartConfig, ZV3ChartName } from "@/app/api/v3/charts/lib/schemas";
import {
  ZV3DashboardChartData,
  ZV3DashboardFilterFields,
  ZV3DashboardFilterValues,
  ZV3DashboardListItem,
  ZV3DashboardResource,
  ZV3DashboardWidget,
} from "@/app/api/v3/dashboards/lib/resources";
import {
  MAX_WIDGETS_PER_WRITE,
  ZV3DashboardName,
  ZV3WidgetLayoutInput,
  refuseEmptyWidgetUpdate,
  refuseInvalidDashboardFilters,
  refuseRepeatedWidgets,
} from "@/app/api/v3/dashboards/lib/schemas";
import { zPostgresText } from "@/lib/utils/postgres-text";
import {
  DASHBOARD_FILTER_OPERATORS,
  MAX_DASHBOARD_FILTERS,
  MAX_DASHBOARD_FILTER_PICK_VALUES,
  MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH,
  NO_VALUE_PICK,
  ZLockedDashboardFilter,
  lockedValuesProblem,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";
import { ZMcpCursorListMeta, mcpToolOutput } from "./output-schemas";

/**
 * Input and output schemas for the chart and dashboard tools. Every input is `.strict()`, so an argument
 * a tool does not declare is a loud error rather than a silently discarded one. Outputs are built from
 * the v3 resource schemas rather than restated, so a tool cannot advertise a shape the API stopped
 * sending.
 */

const datasetScope = {
  workspaceId: ZId.describe("Workspace the chart lives in, from list_workspaces."),
  datasetId: ZId.describe(
    "Feedback Dataset the chart reads. A chart reads exactly one, fixed when it is created."
  ),
};

export const ZMcpListChartFieldsInput = z.object(datasetScope).strict();
export type TMcpListChartFieldsInput = z.infer<typeof ZMcpListChartFieldsInput>;

export const ZMcpChartFieldCatalogOutput = mcpToolOutput(ZV3ChartFieldCatalog);

/**
 * Page size for the list tools. Capped below the API's 250 for the reason the other list tools are: an
 * agent pays for every row in its context window.
 */
const listPaging = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Maximum number of items to return. Defaults to 20."),
  cursor: z.string().min(1).optional().describe("Opaque cursor from the previous page's meta.nextCursor."),
  nameContains: z
    .string()
    .trim()
    .min(1)
    .max(V3_NAME_MAX_LENGTH)
    .optional()
    .describe("Only items whose name contains this text, ignoring case."),
};

export const ZMcpListChartsInput = z
  .object({
    workspaceId: ZId.describe("Workspace whose charts to list, from list_workspaces."),
    ...listPaging,
    datasetId: ZId.optional().describe("Only charts reading this Feedback Dataset."),
  })
  .strict();
export type TMcpListChartsInput = z.infer<typeof ZMcpListChartsInput>;

export const ZMcpChartIdInput = z.object({ chartId: ZId.describe("The chart's id.") }).strict();
export type TMcpChartIdInput = z.infer<typeof ZMcpChartIdInput>;

export const ZMcpChartOutput = mcpToolOutput(ZV3ChartResource);
export const ZMcpChartListOutput = mcpToolOutput(z.array(ZV3ChartResource), ZMcpCursorListMeta);

export const ZMcpChartType = ZChartType.describe(
  "Chart type: area, bar, pie, big_number or matrix. A big_number shows one value, so its grouping is dropped."
);

export const ZMcpChartQuery = z
  .record(z.string(), z.unknown())
  .describe(
    "The chart query in Cube's query format: measures, dimensions, timeDimensions ({ dimension, granularity?, dateRange? }), filters ({ member, operator, values } or { and: [...] } / { or: [...] }), order, limit. Use only field names from list_chart_fields. No timezone: ranges are read in the organization's time zone. Grouped by time alone, a dateRange may span at most 10,000 buckets of its granularity (about 13 months by the hour); use a coarser granularity for longer ranges."
  );

/**
 * A date range the read is for. It narrows the chart's own range on collectedAt, the way the dashboard
 * date filter does (ADR-0026).
 */
export const ZMcpChartDateRange = z
  .union([
    z.string().describe("A date preset from list_chart_fields, or 'all-time' to keep the chart's own range."),
    z
      .object({
        from: z.string().describe("First day, YYYY-MM-DD, inclusive."),
        to: z.string().describe("Last day, YYYY-MM-DD, inclusive."),
      })
      .strict(),
  ])
  .optional()
  .describe(
    "Narrows the chart's date range on FeedbackRecords.collectedAt to the days both cover; ranges that do not overlap give no rows. Read in the organization's time zone."
  );

export const ZMcpPreviewChartInput = z
  .object({
    ...datasetScope,
    type: ZMcpChartType,
    query: ZMcpChartQuery,
    dateRange: ZMcpChartDateRange,
  })
  .strict();
export type TMcpPreviewChartInput = z.infer<typeof ZMcpPreviewChartInput>;

export const ZMcpChartDataOutput = mcpToolOutput(ZV3ChartData);

/**
 * `get_chart_data`'s result: the chart's rows as before, plus `unfilterableFilters` when the read went
 * through a dashboard. Optional, so a client written against the chart-only shape keeps parsing it (S1).
 */
export const ZMcpGetChartDataOutput = mcpToolOutput(
  ZV3ChartData.extend({ unfilterableFilters: ZV3DashboardChartData.shape.unfilterableFilters.optional() })
);

const ZMcpChartConfig = ZV3ChartConfig.describe(
  "Display settings, separate from the query: e.g. showLegend, stacked, barOrientation (vertical|horizontal), pieDisplay (pie|breakdown), areaDisplay (filled|line), colors, axis labels."
);

export const ZMcpCreateChartInput = z
  .object({
    ...datasetScope,
    name: ZV3ChartName.describe("Chart name, unique within the workspace."),
    type: ZMcpChartType,
    query: ZMcpChartQuery,
    config: ZMcpChartConfig.optional(),
  })
  .strict();
export type TMcpCreateChartInput = z.infer<typeof ZMcpCreateChartInput>;

export const ZMcpUpdateChartInput = z
  .object({
    chartId: ZId.describe("The chart to edit."),
    name: ZV3ChartName.optional().describe("New name, unique within the workspace."),
    type: ZMcpChartType.optional(),
    query: ZMcpChartQuery.optional(),
    config: ZMcpChartConfig.optional().describe("Replaces the display settings whole."),
  })
  .strict();
export type TMcpUpdateChartInput = z.infer<typeof ZMcpUpdateChartInput>;

/**
 * What a dashboard filter's values are, for an agent. The no-value pick is written out as JSON escapes,
 * since it starts with a control character.
 */
const FILTER_VALUES_DESCRIPTION = `What to compare with: several values for equals/notEquals on a field with a value list (any of — list_dashboard_filter_values lists them), several emotions for contains/notContains on FeedbackRecords.emotions (contains any of / none of; each one of joy, anger, sadness, fear, surprise, disgust), one value otherwise, none for set/notSet. A day (YYYY-MM-DD) on a time field is the whole day in the organization's reporting time zone: gt is after it, lt before it. With equals/notEquals on a field with a value list, "${JSON.stringify(NO_VALUE_PICK).slice(1, -1)}" stands for "no value": equals with it also matches records without a value, notEquals with it only records with one.`;

/** Refuses values that do not suit the operator: some for set/notSet, none for any other operator. */
const refuseValuesNotSuitingOperator = (
  filter: { operator: (typeof DASHBOARD_FILTER_OPERATORS)[number]; values: readonly string[] },
  ctx: z.RefinementCtx
): void => {
  const problem = lockedValuesProblem(filter);
  if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["values"] });
};

/** A filter an agent applies to a dashboard read: any dimension of the charts' datasets, or an embedded-data field. */
const ZMcpDashboardFilter = z
  .object({
    field: z
      .string()
      .min(1)
      .max(255)
      .describe(
        "A dimension from list_chart_fields, or an embedded-data field (FeedbackRecords.ed_…) from list_dashboard_filter_fields."
      ),
    operator: z
      .enum(DASHBOARD_FILTER_OPERATORS)
      .describe(
        "How the field is compared with the values; set and notSet ask whether it has a value at all. gt, gte, lt and lte on an embedded-data field compare it as a number, only where list_dashboard_filter_fields types it number."
      ),
    values: z
      .array(zPostgresText().max(MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH))
      .max(MAX_DASHBOARD_FILTER_PICK_VALUES)
      .default([])
      .describe(FILTER_VALUES_DESCRIPTION),
  })
  .strict()
  .superRefine(refuseValuesNotSuitingOperator);

const ZMcpDashboardFilters = z.array(ZMcpDashboardFilter).max(MAX_DASHBOARD_FILTERS);
export type TMcpDashboardFilters = z.infer<typeof ZMcpDashboardFilters>;

export const ZMcpGetChartDataInput = z
  .object({
    dashboardId: ZId.optional().describe(
      "Read the chart through this dashboard, as get_dashboard lists its widgets: the dashboard's date range replaces the chart's own and filters apply. Without it the saved chart is read on its own."
    ),
    chartId: ZId.describe("The chart to read: a widget's chartId on that dashboard."),
    dateRange: ZMcpChartDateRange,
    filters: ZMcpDashboardFilters.optional().describe(
      "Filters to apply, each a field, an operator and its values. Each narrows the chart; it never widens it. Needs dashboardId."
    ),
  })
  .strict()
  .refine((input) => input.filters === undefined || input.dashboardId !== undefined, {
    message: "filters need a dashboardId: they narrow the chart as that dashboard shows it.",
    path: ["filters"],
  });
export type TMcpGetChartDataInput = z.infer<typeof ZMcpGetChartDataInput>;

export const ZMcpListDashboardFilterValuesInput = z
  .object({
    dashboardId: ZId.describe("The dashboard whose charts the values are listed for."),
    field: z
      .string()
      .min(1)
      .max(255)
      .describe(
        "A categorical dimension from list_chart_fields (one marked valueLookup, or FeedbackRecords.valueId), a yes/no (boolean) dimension, or an embedded-data field from list_dashboard_filter_fields."
      ),
    operator: z
      .enum(["equals", "notEquals"])
      .default("equals")
      .describe("The comparison the values are for; only equals and notEquals have a list."),
    dateRange: ZMcpChartDateRange,
    filters: ZMcpDashboardFilters.optional().describe(
      "Filters already applied: they narrow the list, as they narrow the charts."
    ),
    search: z
      .string()
      .trim()
      .min(1)
      .max(V3_NAME_MAX_LENGTH)
      .optional()
      .describe("Only values containing this text, ignoring case. Use it when hasMore is true."),
  })
  .strict();
export type TMcpListDashboardFilterValuesInput = z.infer<typeof ZMcpListDashboardFilterValuesInput>;

export const ZMcpDashboardFilterValuesOutput = mcpToolOutput(ZV3DashboardFilterValues);

export const ZMcpDashboardFilterFieldsOutput = mcpToolOutput(ZV3DashboardFilterFields);

export const ZMcpListChartFieldValuesInput = z
  .object({
    ...datasetScope,
    field: z
      .string()
      .min(1)
      .max(128)
      .describe("A field from list_chart_fields with valueLookup: true, e.g. FeedbackRecords.sourceName."),
    search: z
      .string()
      .trim()
      .min(1)
      .max(V3_NAME_MAX_LENGTH)
      .optional()
      .describe("Only values containing this text. Use it when a field has more than 100 values."),
  })
  .strict();
export type TMcpListChartFieldValuesInput = z.infer<typeof ZMcpListChartFieldValuesInput>;

export const ZMcpChartFieldValuesOutput = mcpToolOutput(z.array(ZV3ChartFieldValue));

export const ZMcpListDashboardsInput = z
  .object({
    workspaceId: ZId.describe("Workspace whose dashboards to list, from list_workspaces."),
    ...listPaging,
    chartId: ZId.optional().describe("Only the dashboards that hold this chart."),
  })
  .strict();
export type TMcpListDashboardsInput = z.infer<typeof ZMcpListDashboardsInput>;

export const ZMcpDashboardIdInput = z.object({ dashboardId: ZId.describe("The dashboard's id.") }).strict();
export type TMcpDashboardIdInput = z.infer<typeof ZMcpDashboardIdInput>;

export const ZMcpDashboardListOutput = mcpToolOutput(z.array(ZV3DashboardListItem), ZMcpCursorListMeta);
export const ZMcpDashboardOutput = mcpToolOutput(ZV3DashboardResource);

export const ZMcpCreateDashboardInput = z
  .object({
    workspaceId: ZId.describe("Workspace to create the dashboard in, from list_workspaces."),
    name: ZV3DashboardName.describe("Dashboard name, unique within the workspace."),
  })
  .strict();
export type TMcpCreateDashboardInput = z.infer<typeof ZMcpCreateDashboardInput>;

export const ZMcpUpdateDashboardInput = z
  .object({
    dashboardId: ZId.describe("The dashboard to rename."),
    name: ZV3DashboardName.describe("New name, unique within the workspace."),
  })
  .strict();
export type TMcpUpdateDashboardInput = z.infer<typeof ZMcpUpdateDashboardInput>;

export const ZMcpDuplicateDashboardInput = z
  .object({
    dashboardId: ZId.describe("The dashboard to copy."),
    name: ZV3DashboardName.optional().describe(
      'Name for the copy, unique within the workspace. Without one it is named "<original> (copy)".'
    ),
  })
  .strict();
export type TMcpDuplicateDashboardInput = z.infer<typeof ZMcpDuplicateDashboardInput>;

const ZMcpWidgetLayout = ZV3WidgetLayoutInput.describe(
  "Position and size on the 12-column grid in whole units: x 0-11, w 1-12 with x + w <= 12, y 0-1000, h 1-8. Widgets may leave gaps but not overlap; get_dashboard shows where the others are."
);

export const ZMcpAddChartToDashboardInput = z
  .object({
    dashboardId: ZId.describe("The dashboard to add the chart to."),
    chartId: ZId.describe("A chart in the same workspace. A chart appears at most once per dashboard."),
    layout: ZMcpWidgetLayout.optional().describe(
      "Where to put it. Leave it out to place the chart in the first open slot at its type's default size."
    ),
  })
  .strict();
export type TMcpAddChartToDashboardInput = z.infer<typeof ZMcpAddChartToDashboardInput>;

export const ZMcpUpdateWidgetInput = z
  .object({
    dashboardId: ZId.describe("The dashboard the widget is on."),
    widgetId: ZId.describe("The widget to change, from get_dashboard."),
    layout: ZMcpWidgetLayout.optional(),
    chartId: ZId.optional().describe(
      "Show another chart in this widget's place, e.g. a copy made with duplicate_chart. It must not already be on the dashboard."
    ),
  })
  .strict()
  .superRefine(refuseEmptyWidgetUpdate);
export type TMcpUpdateWidgetInput = z.infer<typeof ZMcpUpdateWidgetInput>;

export const ZMcpRemoveChartFromDashboardInput = z
  .object({
    dashboardId: ZId.describe("The dashboard to take the chart off."),
    widgetId: ZId.describe("The widget showing the chart, from get_dashboard."),
  })
  .strict();
export type TMcpRemoveChartFromDashboardInput = z.infer<typeof ZMcpRemoveChartFromDashboardInput>;

export const ZMcpWidgetOutput = mcpToolOutput(ZV3DashboardWidget);

export const ZMcpUpdateDashboardLayoutInput = z
  .object({
    dashboardId: ZId.describe("The dashboard to rearrange."),
    expectedUpdatedAt: z.iso
      .datetime({ offset: true })
      .describe(
        "The dashboard's updatedAt from your get_dashboard read. If it changed since, nothing is saved: read it again and retry."
      ),
    widgets: z
      .array(
        z
          .object({
            widgetId: ZId.describe("A widget from get_dashboard."),
            layout: ZMcpWidgetLayout,
          })
          .strict()
      )
      .max(MAX_WIDGETS_PER_WRITE)
      .describe("Every widget on the dashboard, each exactly once, with its new layout."),
  })
  .strict()
  .superRefine((input, ctx) => refuseRepeatedWidgets(input.widgets, ctx));
export type TMcpUpdateDashboardLayoutInput = z.infer<typeof ZMcpUpdateDashboardLayoutInput>;

/** A locked filter as an agent sends it: as `get_dashboard` reads it, its id optional for a new one. */
const ZMcpLockedDashboardFilter = z
  .object({
    id: ZLockedDashboardFilter.shape.id
      .optional()
      .describe(
        "The filter's id from get_dashboard, to keep an existing filter. Leave it out for a new one."
      ),
    field: ZLockedDashboardFilter.shape.field.describe(
      "A dimension from list_chart_fields, or an embedded-data field (FeedbackRecords.ed_…) of a dataset the dashboard's charts read, as list_dashboard_filter_fields lists them."
    ),
    operator: ZLockedDashboardFilter.shape.operator.describe(
      "How the field is compared with the values; the field must allow it. gt, gte, lt and lte on an embedded-data field need it to be type number in list_dashboard_filter_fields."
    ),
    label: ZLockedDashboardFilter.shape.label.describe(
      "What readers see the filter as, e.g. the field's label."
    ),
    values: ZLockedDashboardFilter.shape.values.describe(FILTER_VALUES_DESCRIPTION),
  })
  .strict()
  .superRefine(refuseValuesNotSuitingOperator);

/** A placeholder id for a new filter, outside cuid2's alphabet so it never matches a sent one. */
export const newDashboardFilterPlaceholderId = (index: number): string => `new:${index}`;

export const ZMcpSetDashboardFiltersInput = z
  .object({
    dashboardId: ZId.describe("The dashboard whose locked filters to set."),
    expectedUpdatedAt: z.iso
      .datetime({ offset: true })
      .describe(
        "The dashboard's updatedAt from your get_dashboard read. If it changed since, nothing is saved: read it again and retry."
      ),
    filters: z
      .array(ZMcpLockedDashboardFilter)
      .max(MAX_DASHBOARD_FILTERS)
      .superRefine((filters, ctx) =>
        refuseInvalidDashboardFilters(
          filters.map((filter, index) => ({
            ...filter,
            id: filter.id ?? newDashboardFilterPlaceholderId(index),
          })),
          ctx
        )
      )
      .describe(
        `Every locked filter the dashboard should have, at most ${MAX_DASHBOARD_FILTERS}, replacing the saved ones: keep one by sending it back as get_dashboard read it, change one by sending it changed, remove one by leaving it out. An empty list removes them all. Every filter applies to every reader, ANDed together.`
      ),
  })
  .strict();
export type TMcpSetDashboardFiltersInput = z.infer<typeof ZMcpSetDashboardFiltersInput>;

export const ZMcpDuplicateChartInput = z
  .object({
    chartId: ZId.describe("The chart to copy."),
    name: ZV3ChartName.optional().describe(
      'Name for the copy, unique within the workspace. Without one it is named "<original> (copy)".'
    ),
    dashboardId: ZId.optional().describe(
      "Also put the copy on this dashboard, in the same step: if that fails, no copy is left behind."
    ),
    layout: ZMcpWidgetLayout.optional().describe(
      "Where to put the copy on dashboardId. Leave it out for the first open slot."
    ),
  })
  .strict()
  .superRefine(refuseLayoutWithoutDashboard);
export type TMcpDuplicateChartInput = z.infer<typeof ZMcpDuplicateChartInput>;

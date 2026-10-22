import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  ZV3ChartData,
  ZV3ChartFieldCatalog,
  ZV3ChartFieldValue,
  ZV3ChartResource,
} from "@/app/api/v3/charts/lib/resources";
import { V3_NAME_MAX_LENGTH, ZV3ChartConfig, ZV3ChartName } from "@/app/api/v3/charts/lib/schemas";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";
import { mcpToolOutput } from "./output-schemas";

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
export const ZMcpChartListOutput = mcpToolOutput(z.array(ZV3ChartResource));

export const ZMcpChartType = ZChartType.describe(
  "Chart type: area, bar, pie, big_number or matrix. A big_number shows one value, so its grouping is dropped."
);

export const ZMcpChartQuery = z
  .record(z.string(), z.unknown())
  .describe(
    "The chart query in Cube's query format: measures, dimensions, timeDimensions ({ dimension, granularity?, dateRange? }), filters ({ member, operator, values } or { and: [...] } / { or: [...] }), order, limit. Use only field names from list_chart_fields. No timezone: ranges are read in the organization's time zone."
  );

/**
 * A date range the read is for. It replaces the chart's own range on collectedAt, the way the dashboard
 * date filter does.
 */
export const ZMcpChartDateRange = z
  .union([
    z.string().describe("A date preset from list_chart_fields, or 'all-time' to remove the range."),
    z
      .object({
        from: z.string().describe("First day, YYYY-MM-DD, inclusive."),
        to: z.string().describe("Last day, YYYY-MM-DD, inclusive."),
      })
      .strict(),
  ])
  .optional()
  .describe(
    "Replaces the chart's date range on FeedbackRecords.collectedAt. Read in the organization's time zone."
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

export const ZMcpGetChartDataInput = z
  .object({
    chartId: ZId.describe("The chart to read."),
    dateRange: ZMcpChartDateRange,
  })
  .strict();
export type TMcpGetChartDataInput = z.infer<typeof ZMcpGetChartDataInput>;

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

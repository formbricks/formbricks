import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3ChartFieldCatalog, ZV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
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

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZV3ChartFieldCatalog } from "@/app/api/v3/charts/lib/resources";
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

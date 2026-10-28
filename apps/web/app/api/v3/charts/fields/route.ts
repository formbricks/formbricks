/**
 * GET /api/v3/charts/fields — the field catalog: the fields a chart query may use on a Feedback Dataset,
 * with their kind, type, label, description and filter options, plus the date presets.
 *
 * A thin adapter: the operation is shared with the MCP `list_chart_fields` tool.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3ChartFieldCatalog } from "../lib/field-operations";
import { ZV3ChartFieldCatalogQuery } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3ChartFieldCatalogQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3ChartFieldCatalog({
      ...parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});

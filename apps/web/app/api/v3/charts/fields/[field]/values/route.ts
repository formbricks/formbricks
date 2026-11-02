/**
 * GET /api/v3/charts/fields/{field}/values — the stored values of a field, for filters.
 *
 * `rateLimit: false` because the operation charges the chart-query budget itself (600/min, shared with
 * chart data and preview, and with the MCP tools), instead of the v3 default.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3ChartFieldValues } from "../../../lib/field-operations";
import { ZV3ChartFieldValuesParams, ZV3ChartFieldValuesQuery } from "../../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: { params: ZV3ChartFieldValuesParams, query: ZV3ChartFieldValuesQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3ChartFieldValues({
      field: parsedInput.params.field,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});

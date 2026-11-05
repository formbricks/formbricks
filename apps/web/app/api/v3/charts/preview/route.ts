/**
 * POST /api/v3/charts/preview — run an unsaved chart and return its rows. Saves nothing.
 *
 * `rateLimit: false` because the operation charges the chart-query budget itself (600/min, shared with
 * chart data and field values, and with the MCP tools), instead of the v3 default.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { previewV3Chart } from "../lib/data-operations";
import { ZV3ChartPreviewBody } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: { body: ZV3ChartPreviewBody, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    previewV3Chart({ body: parsedInput.body, authentication, requestId, instance }),
});

/**
 * GET /api/v3/charts/{chartId}.
 *
 * The workspace is resolved from the chart, never from the request: any query parameter at all, a
 * `workspaceId` included, is a 400 naming it.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3Chart } from "../lib/operations";
import { ZV3ChartIdParams } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3ChartIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Chart({ chartId: parsedInput.params.chartId, authentication, requestId, instance }),
});

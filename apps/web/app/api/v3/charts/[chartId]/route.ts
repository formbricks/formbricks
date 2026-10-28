/**
 * GET, PATCH and DELETE /api/v3/charts/{chartId}.
 *
 * The workspace is resolved from the chart, never from the request: any query parameter at all, a
 * `workspaceId` included, is a 400 naming it.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Chart, getV3Chart, updateV3Chart } from "../lib/operations";
import { ZV3ChartIdParams, ZV3ChartUpdateBody } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3ChartIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Chart({ chartId: parsedInput.params.chartId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "chart",
  schemas: { params: ZV3ChartIdParams, query: ZV3EmptyQuery, body: ZV3ChartUpdateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Chart({
      chartId: parsedInput.params.chartId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "chart",
  schemas: { params: ZV3ChartIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Chart({ chartId: parsedInput.params.chartId, authentication, auditLog, requestId, instance }),
});

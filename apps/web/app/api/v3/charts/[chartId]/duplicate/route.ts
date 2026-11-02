/**
 * POST /api/v3/charts/{chartId}/duplicate — copy a chart, optionally straight onto a dashboard.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { duplicateV3Chart } from "../../lib/duplicate-operations";
import { ZV3ChartDuplicateBody } from "../../lib/duplicate-schemas";
import { ZV3ChartIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "chart",
  schemas: { params: ZV3ChartIdParams, query: ZV3EmptyQuery, body: ZV3ChartDuplicateBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    duplicateV3Chart({
      chartId: parsedInput.params.chartId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

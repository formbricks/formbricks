/**
 * POST /api/internal/charts/generate — describe a chart in words and get back an unsaved one to review.
 *
 * Internal surface (ENG-6583): no OpenAPI entry and no stability promise, but every other v3 convention
 * applies. Session-only — the app's chart builder is the only caller, and there is no MCP tool for it.
 * One generation per user per minute bounds AI spend.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { generateInternalChart } from "../lib/operations";
import { ZInternalChartGenerateBody } from "../lib/schemas";

// @formbricks/ai pulls the provider SDKs, none of which are edge-compatible.
export const runtime = "nodejs";

export const POST = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.api.internalChartGeneration,
  schemas: { body: ZInternalChartGenerateBody },
  // No action/targetType: nothing is saved here. The query it runs is audited by the Cube client, as
  // every chart query is; the chart, if the user keeps it, by POST /api/v3/charts.
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    generateInternalChart({ body: parsedInput.body, authentication, requestId, instance }),
});

import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ZRetentionRunsExportQuery } from "../schemas";
import { exportRetentionRunsOperation } from "./lib/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/internal/retention-runs/export?organizationId=&from=&to=`: the History CSV, streamed.
 * Internal (session-only, no OpenAPI entry), per ENG-3695. Audited as `exported` on `retentionRun`
 * when the stream ends (ENG-3615).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  action: "exported",
  targetType: "retentionRun",
  customRateLimitConfig: rateLimitConfigs.api.internalRetentionExport,
  schemas: { query: ZRetentionRunsExportQuery },
  handler: async ({ req, authentication, parsedInput, requestId, instance, auditLog }) =>
    exportRetentionRunsOperation({
      req,
      authentication,
      query: parsedInput.query,
      requestId,
      instance,
      auditLog,
    }),
});

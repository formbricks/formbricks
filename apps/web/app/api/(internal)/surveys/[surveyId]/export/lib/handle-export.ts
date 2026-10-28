import "server-only";
import { logger } from "@formbricks/logger";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  problemForbidden,
  problemTooManyRequests,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { type TExportRequest, planExport } from "@/lib/analysis-export/export-request";
import { can } from "@/lib/authorization";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { checkRateLimit } from "@/modules/core/rate-limit/rate-limit";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { ExportCancelledError, buildExportResponse, countExportResponses } from "./export-response";

/**
 * What `POST /api/surveys/{surveyId}/export` does once the wrapper has parsed the request.
 *
 * Authorization is `survey.response_export`, which SpiceDB resolves to workspace read: a read-only seat
 * can export. It is checked after the survey is loaded through `getAuthorizedV3Survey`, so a survey of
 * another workspace and one that does not exist both answer 403, and the filter is only ever applied to
 * `survey.id` from the path: ids in `filter.responseIds` that belong to another survey match nothing.
 */
export const handleExportRequest = async ({
  surveyId,
  body,
  dryRun,
  authentication,
  auditLog,
  signal,
  requestId,
  instance,
}: {
  surveyId: string;
  body: TExportRequest;
  dryRun: boolean;
  authentication: TV3Authentication;
  auditLog?: TV3AuditLog;
  signal: AbortSignal;
  requestId: string;
  instance: string;
}): Promise<Response> => {
  const { survey, authResult, response } = await getAuthorizedV3Survey({
    surveyId,
    authentication,
    access: "read",
    requestId,
    instance,
  });
  if (response) return response;

  const actor = getV3AuthorizationActor(authentication);
  const allowed =
    actor !== null && (await can(actor, "survey.response_export", { type: "survey", id: survey.id }));
  if (!allowed) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  const plan = planExport(body);

  if (dryRun) {
    // A pre-flight reads counts and writes no file, so it is recorded as a query, not an export.
    if (auditLog) {
      auditLog.action = "queried";
      auditLog.organizationId = authResult.organizationId;
      auditLog.targetId = survey.id;
    }
    // The quotas column is part of the Excel size the counts report.
    const counts = await countExportResponses({
      survey,
      plan,
      filter: body.filter,
      isQuotasAllowed: await getIsQuotasEnabled(authResult.organizationId),
    });
    return successResponse({ ...counts, kind: plan.kind }, { requestId });
  }

  const sessionUserId = getSessionUserId(authentication);
  // Charged on the download path only, so the modal's count requests do not spend an export's allowance.
  if (sessionUserId) {
    const limit = await checkRateLimit(rateLimitConfigs.storage.responsesExport, sessionUserId);
    if (limit.ok && !limit.data.allowed) {
      return problemTooManyRequests(requestId, "Too many exports. Try again shortly.", limit.data.retryAfter);
    }
  }

  if (auditLog) {
    auditLog.organizationId = authResult.organizationId;
    auditLog.targetId = survey.id;
  }

  const [organization, isQuotasAllowed] = await Promise.all([
    getOrganization(authResult.organizationId),
    getIsQuotasEnabled(authResult.organizationId),
  ]);

  let result;
  try {
    result = await buildExportResponse({
      survey,
      plan,
      filter: body.filter,
      excludedColumns: body.excludedColumns,
      isQuotasAllowed,
      timeZone: organization?.displayTimeZone ?? "UTC",
      signal,
    });
  } catch (error) {
    if (error instanceof ExportCancelledError) {
      logger.info({ surveyId: survey.id, requestId }, "Export cancelled: the client disconnected");
      // 499 is nginx's "client closed request". Nobody is listening, and it is not a server error.
      return new Response(null, { status: 499 });
    }
    throw error;
  }

  if (!result.ok) {
    return problemUnprocessableContent(requestId, result.message, { instance });
  }

  if (sessionUserId) {
    capturePostHogEvent(
      sessionUserId,
      "responses_exported",
      {
        survey_id: survey.id,
        format: body.format,
        export_kind: plan.kind,
        display: body.display,
        spss_syntax: body.spss,
        filter_applied: Object.keys(body.filter ?? {}).length > 0,
        organization_id: authResult.organizationId,
        workspace_id: authResult.workspaceId,
      },
      { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
    );
  }

  return result.response;
};

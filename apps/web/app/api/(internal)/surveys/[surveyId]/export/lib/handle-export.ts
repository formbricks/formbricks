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
import { ConcurrencyLimiter, type TAcquireResult } from "@/app/lib/api/concurrency-limiter";
import { type TExportRequest, planExport } from "@/lib/analysis-export/export-request";
import { can } from "@/lib/authorization";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { checkRateLimit } from "@/modules/core/rate-limit/rate-limit";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { ExportCancelledError, buildExportResponse, countExportResponses } from "./export-response";

/**
 * An Excel workbook is built whole in memory, about 0.5 GB at the cell cap (`export-limits.ts`), so one build
 * runs per process; a second answers 429 and the modal's retry picks it up. CSV and the zip stream and are
 * bounded by the route's own limiter instead. Exported for the tests.
 */
export const excelBuildLimiter = new ConcurrencyLimiter(1);
const EXCEL_BUSY_RETRY_SECONDS = 15;

/**
 * A second Excel export waits for the slot instead of being refused on the spot: a build takes seconds, and
 * even today's Standard export is one. Up to `EXCEL_MAX_WAITERS` wait at once, each for at most
 * `EXCEL_WAIT_MS`; past either, the answer is the 429. Exported for the tests.
 */
export const EXCEL_WAIT_MS = 60_000;
export const EXCEL_MAX_WAITERS = 8;
const EXCEL_POLL_MS = 100;
let excelWaiters = 0;

const acquireExcelSlot = async (signal: AbortSignal): Promise<TAcquireResult> => {
  const first = excelBuildLimiter.tryAcquire();
  if (first.ok || excelWaiters >= EXCEL_MAX_WAITERS) return first;

  excelWaiters += 1;
  try {
    const deadline = Date.now() + EXCEL_WAIT_MS;
    while (!signal.aborted && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, EXCEL_POLL_MS));
      const next = excelBuildLimiter.tryAcquire();
      if (next.ok) return next;
    }
    return first;
  } finally {
    excelWaiters -= 1;
  }
};

/** Charged on the download path only, so the modal's count requests do not spend an export's allowance. */
const rateLimitedResponse = async (
  sessionUserId: string | null | undefined,
  requestId: string
): Promise<Response | null> => {
  if (!sessionUserId) return null;
  const limit = await checkRateLimit(rateLimitConfigs.storage.responsesExport, sessionUserId);
  if (limit.ok && !limit.data.allowed) {
    return problemTooManyRequests(requestId, "Too many exports. Try again shortly.", limit.data.retryAfter);
  }
  return null;
};

type TBuiltExport = Awaited<ReturnType<typeof buildExportResponse>>;

/**
 * Runs the build under the Excel limit: a workbook takes the process's one slot for as long as it is built
 * (a second one waits for it, and is a 429 only when the wait queue is full or times out), and a client that
 * went away is a 499. Anything else it throws is the caller's.
 */
const buildWithinLimits = async ({
  format,
  requestId,
  signal,
  surveyId,
  build,
}: {
  format: TExportRequest["format"];
  requestId: string;
  signal: AbortSignal;
  surveyId: string;
  build: () => Promise<TBuiltExport>;
}): Promise<TBuiltExport | Response> => {
  const excelSlot = format === "xlsx" ? await acquireExcelSlot(signal) : null;
  if (excelSlot && !excelSlot.ok) {
    // Gave up waiting because the client left: nobody is listening for the 429.
    if (signal.aborted) return new Response(null, { status: 499 });
    return problemTooManyRequests(
      requestId,
      "Another Excel export is being built. Try again in a moment, or export as CSV.",
      EXCEL_BUSY_RETRY_SECONDS
    );
  }

  try {
    return await build();
  } catch (error) {
    if (error instanceof ExportCancelledError) {
      logger.info({ surveyId, requestId }, "Export cancelled: the client disconnected");
      // 499 is nginx's "client closed request". Nobody is listening, and it is not a server error.
      return new Response(null, { status: 499 });
    }
    throw error;
  } finally {
    // The workbook is whole once the build returns; sending it holds no build memory.
    if (excelSlot?.ok) excelSlot.release();
  }
};

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
  const rateLimited = await rateLimitedResponse(sessionUserId, requestId);
  if (rateLimited) return rateLimited;

  if (auditLog) {
    auditLog.organizationId = authResult.organizationId;
    auditLog.targetId = survey.id;
  }

  const [organization, isQuotasAllowed] = await Promise.all([
    getOrganization(authResult.organizationId),
    getIsQuotasEnabled(authResult.organizationId),
  ]);

  const built = await buildWithinLimits({
    format: body.format,
    requestId,
    signal,
    surveyId: survey.id,
    build: () =>
      buildExportResponse({
        survey,
        plan,
        filter: body.filter,
        excludedColumns: body.excludedColumns,
        isQuotasAllowed,
        timeZone: organization?.displayTimeZone ?? "UTC",
        signal,
      }),
  });
  if (built instanceof Response) return built;
  const result = built;

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

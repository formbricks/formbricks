import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  type InvalidParam,
  createdResponse,
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { createV3SurveyResponse, getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { capturePostHogEvent } from "@/lib/posthog";
import { formbricksLane } from "@/modules/survey/import/lanes/formbricks";
import {
  buildImportCreatedProperties,
  buildImportFailedProperties,
} from "@/modules/survey/import/lib/import-analytics";
import { type TResolveImportResult, resolveImportCandidate } from "@/modules/survey/import/resolve";
import type { TImportCandidate, TImportReport } from "@/modules/survey/import/types";
import type { TV3SurveyImportBody } from "../schemas";
import { guardImportWorkspaceBudget } from "./import-guards";

type TImportV3SurveyParams = {
  req: Request;
  body: TV3SurveyImportBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** Report errors as v3 `invalid_params`, so agents repair a file the same way they repair a create body. */
export function reportErrorsToInvalidParams(report: TImportReport): InvalidParam[] {
  return report.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => ({ name: issue.path ?? "document", reason: issue.message }));
}

async function runLosslessImport(
  body: TV3SurveyImportBody,
  ctx: {
    workspaceId: string;
    organizationId: string;
    userId: string | null;
    requestId: string;
    importRunId: string;
  }
): Promise<TResolveImportResult> {
  const candidate: TImportCandidate = await formbricksLane(
    {
      kind: body.export !== undefined ? "formbricks-export" : "v3-document",
      content: { type: "json", value: body.export ?? body.document },
    },
    ctx
  );

  // A resolved draft sent back by the dialog carries its references next to the document.
  if (!candidate.references && body.references) {
    candidate.references = body.references;
  }

  return resolveImportCandidate(candidate, {
    workspaceId: ctx.workspaceId,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    requestId: ctx.requestId,
    dryRun: body.options?.dryRun === true,
    name: body.options?.name,
  });
}

/**
 * `POST /api/v3/surveys/import` — the lossless lane on the public API, and the one door every lane
 * creates through: the dialog sends the reviewed document here after a convert.
 *
 * `options.dryRun` answers 200 with the resolved document, the report and the validation, and writes
 * nothing. Otherwise a report with errors answers 422 (the report rides in `details`), and a valid
 * document is created through the shared v3 create path with `createdFrom: "import"`.
 */
export async function importV3Survey({
  req,
  body,
  authentication,
  requestId,
  instance,
}: TImportV3SurveyParams): Promise<Response> {
  const importRunId = createId();
  const log = logger.withContext({ requestId, importRunId, workspaceId: body.workspaceId });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const budget = await guardImportWorkspaceBudget(authResult.workspaceId, requestId);
    if (budget) {
      log.warn({ statusCode: 429 }, "Workspace import budget exhausted");
      return budget;
    }

    const resolved = await runLosslessImport(body, {
      workspaceId: authResult.workspaceId,
      organizationId: authResult.organizationId,
      userId: getSessionUserId(authentication),
      requestId,
      importRunId,
    });

    if (body.options?.dryRun === true) {
      return successResponse(
        {
          document: resolved.document,
          references: body.references ?? null,
          report: resolved.report,
          validation: resolved.validation,
        },
        { requestId, cache: "private, no-store" }
      );
    }

    if (!resolved.createBody) {
      const invalidParams =
        resolved.validation.invalid_params.length > 0
          ? resolved.validation.invalid_params
          : reportErrorsToInvalidParams(resolved.report);
      log.warn(
        { statusCode: 422, sourceKind: resolved.report.source.kind, invalidParamCount: invalidParams.length },
        "Survey import refused"
      );
      const refusedBy = getSessionUserId(authentication);
      if (refusedBy) {
        capturePostHogEvent(
          refusedBy,
          "survey_import_failed",
          buildImportFailedProperties({
            sourceKind: resolved.report.source.kind,
            lane: resolved.report.source.lane,
            code:
              resolved.report.issues.find((issue) => issue.severity === "error")?.code ?? "invalid_document",
            status: 422,
          }),
          { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
        );
      }
      return problemUnprocessableContent(requestId, "The survey could not be imported", {
        instance,
        invalid_params: invalidParams,
        details: { report: resolved.report },
      });
    }

    // Audited by hand rather than through the wrapper: a dry run must not leave a `created` row.
    const auditLog = buildV3AuditLog(authentication, "created", "survey", req.url);

    const createResponse = await createV3SurveyResponse({
      body: resolved.createBody,
      authentication,
      requestId,
      instance,
      auditLog,
      authResult,
      createdFrom: "import",
      createOptions: { skipExternalUrlPermissionCheck: true },
      analyticsProperties: buildImportCreatedProperties(resolved.report),
    });

    if (auditLog) {
      auditLog.status = createResponse.ok ? "success" : "failure";
      if (!createResponse.ok) auditLog.eventId = requestId;
      // The audit row names the import run and its source so an operator can trace a survey back to its file.
      if (auditLog?.newObject && typeof auditLog.newObject === "object") {
        auditLog.newObject = {
          ...(auditLog.newObject as Record<string, unknown>),
          import: { importRunId, sourceKind: resolved.report.source.kind, lane: resolved.report.source.lane },
        };
      }
      await queueV3AuditLog(auditLog, requestId, log);
    }

    if (createResponse.status !== 201) {
      return createResponse;
    }

    const created = (await createResponse.json()) as { data: { id: string } };
    return createdResponse(
      { survey: created.data, report: resolved.report },
      { requestId, location: createResponse.headers.get("Location") ?? `/api/v3/surveys/${created.data.id}` }
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey import unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

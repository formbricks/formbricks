import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getRateLimitIdentifier } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { mapV3SurveyGenerateError } from "@/app/api/v3/surveys/generate/error-mapping";
import {
  guardImportWorkspaceBudget,
  problemImportInProgress,
} from "@/app/api/v3/surveys/import/lib/import-guards";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { type TImportDetectionFailureCode, detectImportSource } from "@/modules/survey/import/detect";
import { getImportLaneHandler } from "@/modules/survey/import/lanes";
import { ImportInProgressError, acquireAiImportSlot } from "@/modules/survey/import/lib/ai-inflight-guard";
import { resolveImportCandidate } from "@/modules/survey/import/resolve";
import { IMPORT_LANE_BY_KIND, type TImportContext } from "@/modules/survey/import/types";
import type { TV3SurveyImportConvertBody } from "../schemas";

type TConvertImportParams = {
  body: TV3SurveyImportConvertBody;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const DETECTION_FAILURE_REASONS: Record<TImportDetectionFailureCode, string> = {
  empty_file: "The file is empty.",
  legacy_office_format:
    "Legacy Office formats are not supported. Save the file as .docx or .xlsx and try again.",
  unsupported_source:
    "This file type is not supported. Use a Formbricks export (.json), a Qualtrics .qsf, or a .docx, .pdf, .md, .txt, .csv or .xlsx document.",
  invalid_json: "The file is not valid JSON.",
};

/** The 422 for a file the allowlist rejects; shared with the internal import stream. */
export function problemForImportDetectionFailure(
  requestId: string,
  instance: string,
  code: TImportDetectionFailureCode
): Response {
  return problemUnprocessableContent(requestId, DETECTION_FAILURE_REASONS[code], {
    instance,
    code: code === "legacy_office_format" ? "legacy_office_format" : "unsupported_source",
    invalid_params: [{ name: "file", reason: DETECTION_FAILURE_REASONS[code] }],
  });
}

/**
 * AI-lane guards, in order: entitlement, then the shared 10/min AI budget. Both run before the file
 * is read so an org without AI never pays for extraction; shared with the internal import stream.
 */
export async function assertAiImportAllowed(
  organizationId: string,
  authentication: TV3Authentication
): Promise<void> {
  await assertOrganizationAIConfigured(organizationId);
  const identifier = getRateLimitIdentifier(authentication);
  if (identifier) {
    await applyRateLimit(rateLimitConfigs.api.v3SurveyGenerate, identifier);
  }
}

/**
 * `POST /api/v3/surveys/import/convert` — turn a file into a reviewed survey document without
 * persisting anything. Detect → lane → resolve (always dry run: creating is the import route's job).
 *
 * A file the allowlist rejects is a 422 (the request was well-formed; the file is not something we
 * take), a non-multipart request is a 415 (wrapper), a lane that has not shipped is a 400
 * `lane_not_available`. A file the lane cannot read still answers 200 with `document: null` and
 * the reasons in `report` — the dialog shows them; the 422 belongs to the persisting endpoint.
 */
export async function convertImportFile({
  body,
  authentication,
  requestId,
  instance,
}: TConvertImportParams): Promise<Response> {
  const importRunId = createId();
  const file = body.files[0];
  const extension = file.fileName.split(".").pop()?.toLowerCase() ?? null;
  const log = logger.withContext({
    requestId,
    importRunId,
    workspaceId: body.fields.workspaceId,
    fileExtension: extension,
    fileBytes: file.bytes.byteLength,
  });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      body.fields.workspaceId,
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

    const detection = detectImportSource({
      fileName: file.fileName,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
    if (!detection.ok) {
      log.warn({ statusCode: 422, detectionCode: detection.code }, "Import file rejected");
      return problemForImportDetectionFailure(requestId, instance, detection.code);
    }

    const lane = getImportLaneHandler(detection.kind);
    if (!lane) {
      log.warn({ statusCode: 400, sourceKind: detection.kind }, "Import lane not available");
      return problemBadRequest(requestId, `Importing ${detection.kind} files is not available yet`, {
        instance,
        code: "lane_not_available",
        invalid_params: [{ name: "file", reason: `No import lane handles '${detection.kind}' files yet` }],
      });
    }

    const ctx: TImportContext = {
      workspaceId: authResult.workspaceId,
      organizationId: authResult.organizationId,
      userId: getSessionUserId(authentication),
      requestId,
      importRunId,
      languageHint: body.fields.language,
    };
    const isAiLane = IMPORT_LANE_BY_KIND[detection.kind] === "ai";
    const aiErrorContext = {
      requestId,
      instance,
      workspaceId: authResult.workspaceId,
      organizationId: authResult.organizationId,
    };
    const startedAt = Date.now();

    let candidate;
    let releaseSlot: (() => Promise<void>) | null = null;
    try {
      if (isAiLane) {
        await assertAiImportAllowed(authResult.organizationId, authentication);
        releaseSlot = await acquireAiImportSlot(
          getRateLimitIdentifier(authentication) ?? authResult.workspaceId
        );
      }

      candidate = await lane(
        { kind: detection.kind, fileName: file.fileName, content: { type: "bytes", bytes: file.bytes } },
        ctx
      );
    } catch (error) {
      if (!isAiLane) throw error;
      if (error instanceof ImportInProgressError) {
        log.warn(
          { statusCode: 409, sourceKind: detection.kind, lane: "ai" },
          "AI import already in progress"
        );
        return problemImportInProgress(requestId, error, instance);
      }
      log.warn(
        { err: error, statusCode: 502, sourceKind: detection.kind, lane: "ai" },
        "AI import lane failed"
      );
      return mapV3SurveyGenerateError(error, aiErrorContext);
    } finally {
      await releaseSlot?.();
    }

    const resolved = await resolveImportCandidate(candidate, {
      workspaceId: authResult.workspaceId,
      organizationId: authResult.organizationId,
      userId: ctx.userId,
      requestId,
      dryRun: true,
    });

    log.info(
      {
        sourceKind: resolved.report.source.kind,
        lane: resolved.report.source.lane,
        valid: resolved.validation.valid,
        issueCount: resolved.report.issues.length,
      },
      "Import file converted"
    );

    if (isAiLane && ctx.userId && resolved.document) {
      capturePostHogEvent(
        ctx.userId,
        "ai_survey_imported",
        {
          source_kind: detection.kind,
          chunk_count: resolved.report.source.chunks ?? 1,
          question_count: resolved.report.summary.elements,
          language_count: resolved.report.summary.languages.length,
          chars: file.bytes.byteLength,
          duration_ms: Date.now() - startedAt,
        },
        { organizationId: authResult.organizationId, workspaceId: authResult.workspaceId }
      );
    }

    return successResponse(
      {
        document: resolved.document,
        references: candidate.references ?? null,
        report: resolved.report,
        validation: resolved.validation,
        source: resolved.report.source,
      },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }

    log.error({ error, statusCode: 500 }, "V3 survey import convert unexpected error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

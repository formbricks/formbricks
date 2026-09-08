import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { type TImportDetectionFailureCode, detectImportSource } from "@/modules/survey/import/detect";
import { getImportLaneHandler } from "@/modules/survey/import/lanes";
import { resolveImportCandidate } from "@/modules/survey/import/resolve";
import type { TImportContext } from "@/modules/survey/import/types";
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

    const detection = detectImportSource({
      fileName: file.fileName,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
    if (!detection.ok) {
      log.warn({ statusCode: 422, detectionCode: detection.code }, "Import file rejected");
      return problemUnprocessableContent(requestId, DETECTION_FAILURE_REASONS[detection.code], {
        instance,
        code: detection.code === "legacy_office_format" ? "legacy_office_format" : "unsupported_source",
        invalid_params: [{ name: "file", reason: DETECTION_FAILURE_REASONS[detection.code] }],
      });
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

    const candidate = await lane(
      { kind: detection.kind, fileName: file.fileName, content: { type: "bytes", bytes: file.bytes } },
      ctx
    );

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

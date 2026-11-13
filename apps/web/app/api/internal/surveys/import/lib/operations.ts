import "server-only";
import { logger } from "@formbricks/logger";
import { isClientAbort } from "@/app/api/internal/lib/ai-stream-errors";
import { createNdjsonResponse } from "@/app/api/internal/lib/ndjson-stream";
import { createRequestAbort } from "@/app/api/internal/lib/request-abort";
import { loggableAIError, mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { loggableError } from "@/app/api/v3/lib/loggable-error";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import { problemInternalError } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { resolveV3SurveyResourceVisibility } from "@/app/api/v3/surveys/visibility-context";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { getAITimeoutMs } from "@/lib/ai/timeout";
import { findUpdatableSurvey } from "@/modules/survey/formbricks-file/update";
import {
  SurveyImportFileTooLargeError,
  SurveyImportTimeoutError,
  toRefusalResponse,
} from "@/modules/survey/import/core/errors";
import type { TSurveyImportLane, TSurveyImportResult } from "@/modules/survey/import/core/lane";
import { type TSpreadsheetRead, readingOrThrow } from "@/modules/survey/import/core/read-upload";
import {
  type TSurveyImportUpload,
  openSurveyImportUpload,
  readSurveyImportUploadAs,
} from "@/modules/survey/import/core/upload-thread";
import { DOCUMENT_IMPORT_LANES } from "@/modules/survey/import/document/lane";
import { type TExcelExportTarget, excelExportImportLane } from "@/modules/survey/import/excel-export/lane";
import { formbricksFileImportLane } from "@/modules/survey/import/formbricks/lane";
import { SURVEY_IMPORT_DEADLINE_MS, SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";
import { qsfImportLane } from "@/modules/survey/import/qsf/lane";
import type { TSurveyImportStage } from "@/modules/survey/import/types";
import { SURVEY_IMPORT_HEARTBEAT_MS } from "./constants";
import { importTimedOutEvent, toSurveyImportStreamErrorEvent } from "./error-events";
import { SURVEY_IMPORT_STREAM_ERROR_CODES, type TSurveyImportStreamEvent } from "./events";
import { getSurveyImportFileName } from "./schemas";

/**
 * Stream failures that describe the file, which the user can act on, rather than a fault. Not
 * `import_partly_unread`: AI calls failed on the way there, which is an incident to see.
 */
const FILE_OUTCOME_CODES: ReadonlySet<string> = new Set([
  SURVEY_IMPORT_STREAM_ERROR_CODES.TOO_LARGE,
  SURVEY_IMPORT_STREAM_ERROR_CODES.NOTHING_IMPORTABLE,
]);

const OPERATION = "surveys.import";

interface TStreamSurveyImportParams {
  req: Request;
  authentication: TV3Authentication;
  workspaceId: string;
  /**
   * The uploaded file. Its type comes from its bytes; its name is display text, carried into the
   * report and nowhere else. Read in memory and dropped: nothing is stored.
   */
  file: File;
  requestId: string;
  instance: string;
}

export interface TRunSurveyImportLaneParams<TInput, TPrepared> {
  req: Request;
  authentication: TV3Authentication;
  organizationId: string;
  workspaceId: string;
  lane: TSurveyImportLane<TInput, TPrepared>;
  input: TInput;
  fileBytes: number;
  requestId: string;
  instance: string;
}

/** What every lane's run is given besides the lane and its input. */
type TSurveyImportLaneContext = Omit<TRunSurveyImportLaneParams<unknown, unknown>, "lane" | "input">;

type TImportOutcome = "done" | "failed" | "timed_out" | "aborted";

/**
 * Read the upload and tell its type from its bytes, in a thread of its own, under the upload's limits:
 * the file's size, then what `sniffSurveyImportFile` checks (the zip limits for a `.docx` or `.xlsx`, the
 * JSON budget for a JSON file). Throws the refusals `toRefusalResponse` maps, and stops when the client
 * leaves.
 */
const openUpload = async (file: File, signal: AbortSignal): Promise<TSurveyImportUpload> => {
  if (file.size > SURVEY_IMPORT_MAX_FILE_BYTES) {
    throw new SurveyImportFileTooLargeError(
      "file_size",
      `The file must not exceed ${SURVEY_IMPORT_MAX_FILE_BYTES} bytes`
    );
  }
  return openSurveyImportUpload(new Uint8Array(await file.arrayBuffer()), { signal });
};

/**
 * What a request whose client left is answered with: nobody reads it, and it is no failure of the
 * server's. 499 is the conventional "client closed request".
 */
const clientClosedRequest = () => new Response(null, { status: 499 });

/** The context a request's failures are answered and logged with: any lane's run is given it whole. */
type TSurveyImportFailureContext = Pick<
  TSurveyImportLaneContext,
  "req" | "requestId" | "instance" | "workspaceId" | "organizationId"
>;

/**
 * The response for an upload or a file that could not be read: the client left, the file is refused,
 * or the server failed to read it. `sourceKind` is the lane's, once the file's type is known.
 */
const toUnreadFileResponse = (
  error: unknown,
  { req, requestId, instance, workspaceId, organizationId }: TSurveyImportFailureContext,
  sourceKind?: string
): Response => {
  if (isClientAbort(req.signal)) return clientClosedRequest();
  const refusal = toRefusalResponse(error, requestId, instance);
  if (refusal) return refusal;

  // Not through mapV3ThrownError, which logs the error whole: a reader that fails on the file can
  // quote it in the message.
  logger
    .withContext({ requestId, workspaceId, organizationId, ...(sourceKind ? { sourceKind } : {}) })
    .error(
      { ...loggableError(error), operation: OPERATION, statusCode: 500 },
      "Survey import could not read the file"
    );
  return problemInternalError(requestId, undefined, instance);
};

/** Open the upload in its thread, or the response that refuses it (`toUnreadFileResponse`). */
const openUploadOrRefuse = async (
  file: File,
  context: TSurveyImportFailureContext
): Promise<TSurveyImportUpload | Response> => {
  try {
    return await openUpload(file, context.req.signal);
  } catch (error) {
    return toUnreadFileResponse(error, context);
  }
};

/**
 * Import an uploaded survey file, streaming progress as NDJSON (ENG-3604, ENG-3653, ENG-6846,
 * ENG-6848). Every file type comes in the same way: the route's wrapper has already authenticated,
 * charged the default v3 bucket, read the multipart body within its byte limit and then taken a
 * concurrency slot. Here the workspace is checked first, then the file's type is told from its content
 * in the upload's own thread (`openSurveyImportUpload`), and the file goes to its type's lane: a
 * Formbricks file, a survey's Excel export the user may update (ENG-6809), a Qualtrics export, or a
 * questionnaire from Excel, CSV (ENG-6852) or Word (ENG-6853).
 *
 * Nothing is written: the dialog shows the draft for review and creates it through
 * `POST /api/internal/surveys/imports` (ENG-6850), a Formbricks file with its references, or updates a
 * matched survey through `PUT /api/internal/surveys/{surveyId}/content`; that write is what the audit
 * log records.
 */
export async function streamSurveyImport({
  req,
  authentication,
  workspaceId: requestedWorkspaceId,
  file,
  requestId,
  instance,
}: TStreamSurveyImportParams): Promise<Response> {
  const workspaceAccess = await requireV3WorkspaceAccess(
    authentication,
    requestedWorkspaceId,
    "readWrite",
    requestId,
    instance
  );

  if (workspaceAccess instanceof Response) {
    return workspaceAccess;
  }

  const { organizationId, workspaceId } = workspaceAccess;

  const lane: TSurveyImportLaneContext = {
    req,
    authentication,
    organizationId,
    workspaceId,
    fileBytes: file.size,
    requestId,
    instance,
  };
  const upload = await openUploadOrRefuse(file, lane);
  if (upload instanceof Response) return upload;

  // The name the user's file had, cleaned for the report to show. Never a path, never stored.
  const fileName = getSurveyImportFileName(file);

  // The upload's thread waits for its lane's read, and ends once the lane has it, or here.
  try {
    switch (upload.type) {
      case "qsf":
        return await runSurveyImportLane({
          ...lane,
          lane: qsfImportLane,
          input: { read: async () => (await readSurveyImportUploadAs(upload, "qsf", fileName)).prepared },
        });
      case "formbricks":
        return await runSurveyImportLane({
          ...lane,
          lane: formbricksFileImportLane,
          input: {
            read: async () => (await readSurveyImportUploadAs(upload, "formbricks", fileName)).read,
            fileName,
            workspaceId,
            organizationId,
            authentication,
          },
        });
      case "xlsx":
        return await streamSpreadsheetImport({ lane, upload, fileName });
      case "csv":
      case "docx": {
        const { type } = upload;
        return await runSurveyImportLane({
          ...lane,
          lane: DOCUMENT_IMPORT_LANES[type],
          input: { read: async () => (await readSurveyImportUploadAs(upload, type, fileName)).prepared },
        });
      }
    }
  } finally {
    upload.close();
  }
}

/**
 * The survey an Excel export names (ENG-6809), when the user may update it: found as a Formbricks file's
 * Match is (`findUpdatableSurvey`), so anything else is `null`, the same as a survey that never existed,
 * and the workbook goes to the document import like any other spreadsheet.
 */
const findExcelExportTarget = async (
  surveyId: string,
  { authentication, workspaceId, organizationId }: TSurveyImportLaneContext
): Promise<TExcelExportTarget | null> => {
  const found = await findUpdatableSurvey({
    surveyId,
    workspaceId,
    actor: getV3AuthorizationActor(authentication),
  });
  if (!found) return null;
  return {
    ...found,
    visibility: await resolveV3SurveyResourceVisibility(found.survey, authentication, organizationId),
  };
};

/**
 * An `.xlsx` upload's lane, which only its content decides: the Excel export of a survey the user may
 * update goes to the Excel export lane, read by its layout with no AI and matched with that survey
 * (ENG-6809); any other workbook, an export of a survey they may not update included, to the document
 * import (ENG-6848), as on any other spreadsheet.
 *
 * The workbook is read for both, in one parse, before either lane's checks: which lane it takes, and so
 * which rate limit and AI gate apply, is known only once its meta sheet is read. The read is bounded by
 * the upload's limits and runs in its thread, as every read does, the same as a Formbricks file's, which
 * has no lane limit either. What a lane refuses is refused in that lane, after its rate limit and AI gate.
 */
const streamSpreadsheetImport = async ({
  lane,
  upload,
  fileName,
}: {
  lane: TSurveyImportLaneContext;
  upload: TSurveyImportUpload;
  fileName: string;
}): Promise<Response> => {
  let spreadsheet: TSpreadsheetRead;
  try {
    spreadsheet = await readSurveyImportUploadAs(upload, "xlsx", fileName);
  } catch (error) {
    return toUnreadFileResponse(error, lane, "xlsx");
  }

  const { excelExport, document } = spreadsheet;
  const target = excelExport ? await findExcelExportTarget(excelExport.surveyId, lane) : null;

  if (excelExport && target) {
    const { reading } = excelExport;
    return runSurveyImportLane({
      ...lane,
      lane: excelExportImportLane,
      input: {
        // Lazy, so a refusal the reading carries rejects in the lane, after its own checks.
        read: () => Promise.resolve().then(() => readingOrThrow(reading).read),
        fileName,
        workspaceId: lane.workspaceId,
        organizationId: lane.organizationId,
        authentication: lane.authentication,
        target,
        signal: lane.req.signal,
      },
    });
  }

  return runSurveyImportLane({
    ...lane,
    lane: DOCUMENT_IMPORT_LANES.xlsx,
    input: { read: () => Promise.resolve().then(() => readingOrThrow(document).prepared) },
  });
};

/**
 * Run one lane over its file. The ordering is the design: **every check that can answer with a problem
 * response runs before the response body opens** — the lane's own rate limit, the AI gate (for a lane
 * that uses AI), and the lane's file read — because once a 200 has started there is no way back to
 * RFC 9457. Only failures during the import itself become `error` events.
 */
export async function runSurveyImportLane<TInput, TPrepared>({
  req,
  authentication,
  organizationId,
  workspaceId,
  lane,
  input,
  fileBytes,
  requestId,
  instance,
}: TRunSurveyImportLaneParams<TInput, TPrepared>): Promise<Response> {
  const userId = getSessionUserId(authentication);
  const log = logger.withContext({ requestId, workspaceId, organizationId, sourceKind: lane.kind });

  if (lane.rateLimit) {
    const rateLimited = await applyV3OperationRateLimit({
      config: lane.rateLimit,
      authentication,
      requestId,
      instance,
    });
    if (rateLimited) return rateLimited;
  }

  if (lane.usesAI) {
    try {
      await assertOrganizationAIConfigured(organizationId);
    } catch (error) {
      return (
        mapV3AIError(error, { requestId, instance, workspaceId, organizationId, operation: OPERATION }) ??
        mapV3ThrownError(error, { log, requestId, instance, operation: OPERATION })
      );
    }
  }

  let prepared: TPrepared;
  try {
    prepared = await lane.prepare(input);
  } catch (error) {
    return toUnreadFileResponse(error, { req, requestId, instance, workspaceId, organizationId }, lane.kind);
  }

  // AI_TIMEOUT_MULTIPLIER stretches what AI calls may take; a lane without them has none to stretch.
  const deadlineMs = lane.usesAI ? getAITimeoutMs(SURVEY_IMPORT_DEADLINE_MS) : SURVEY_IMPORT_DEADLINE_MS;
  const importAbort = createRequestAbort(req, { deadlineMs });
  const startedAt = performance.now();
  let stage: TSurveyImportStage = "reading";
  let outcome: TImportOutcome = "failed";
  let errorCode: string | undefined;
  let result: TSurveyImportResult | undefined;

  return createNdjsonResponse<TSurveyImportStreamEvent>({
    heartbeat: { intervalMs: SURVEY_IMPORT_HEARTBEAT_MS, event: () => ({ type: "progress", stage }) },
    produce: async (emit) => {
      const reportStage = (next: TSurveyImportStage) => {
        stage = next;
        emit({ type: "progress", stage: next });
      };

      emit({ type: "start", requestId });
      reportStage("reading");

      result = await lane.run({
        prepared,
        workspaceId,
        organizationId,
        userId,
        signal: importAbort.signal,
        deadlineMs,
        onProgress: reportStage,
      });

      emit({
        type: "done",
        payload: result.payload,
        report: result.report,
        ...(result.references ? { references: result.references } : {}),
        ...(result.match ? { match: result.match } : {}),
      });
      outcome = "done";
    },
    onError: (error) => {
      // Before the client-abort check: the deadline aborts the same signal, and a timeout is something
      // to tell the user, not a quiet exit. An import whose AI calls all ran out of time before any
      // question was planned is the same to them; one slow call alone never ends the import.
      const planTimedOut = error instanceof SurveyImportTimeoutError;
      if (importAbort.deadlineExceeded() || planTimedOut) {
        outcome = "timed_out";
        const event = importTimedOutEvent();
        errorCode = event.code;
        log.warn({ deadlineMs, planTimedOut }, "Survey import hit its deadline");
        return event;
      }

      if (isClientAbort(importAbort.signal)) {
        // Pressing Stop is not an incident. The socket is gone, so there is nobody to tell either.
        outcome = "aborted";
        return null;
      }

      const event = toSurveyImportStreamErrorEvent(error);
      errorCode = event.code;
      // A file past the AI ceiling, or with nothing to import, is the file's doing, not an incident.
      if (FILE_OUTCOME_CODES.has(event.code))
        log.warn({ errorCode: event.code }, "Survey import refused the file");
      else log.error(loggableAIError(error), "Survey import failed");
      return event;
    },
    onCancel: importAbort.abort,
    onSettled: () => {
      importAbort.dispose();
      // Metadata only — never the file's content (ENG-3604).
      log.info(
        {
          outcome,
          errorCode,
          stage,
          durationMs: Math.round(performance.now() - startedAt),
          fileBytes,
          questionCount: result?.report.summary.questions,
          inputTokens: result?.usage?.inputTokens,
          outputTokens: result?.usage?.outputTokens,
        },
        "Survey import finished"
      );
    },
  });
}

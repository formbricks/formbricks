import "server-only";
import { logger } from "@formbricks/logger";
import { isClientAbort } from "@/app/api/internal/lib/ai-stream-errors";
import { createNdjsonResponse } from "@/app/api/internal/lib/ndjson-stream";
import { createRequestAbort } from "@/app/api/internal/lib/request-abort";
import { loggableAIError, mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { loggableError } from "@/app/api/v3/lib/loggable-error";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import { problemInternalError } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { getAITimeoutMs } from "@/lib/ai/timeout";
import {
  SurveyImportFileTooLargeError,
  SurveyImportTimeoutError,
  toRefusalResponse,
} from "@/modules/survey/import/core/errors";
import type { TSurveyImportLane, TSurveyImportResult } from "@/modules/survey/import/core/lane";
import { type TSurveyImportFile, sniffSurveyImportFile } from "@/modules/survey/import/core/sniff";
import { DOCUMENT_IMPORT_LANES } from "@/modules/survey/import/document/lane";
import { formbricksFileImportLane } from "@/modules/survey/import/formbricks/lane";
import { SURVEY_IMPORT_DEADLINE_MS, SURVEY_IMPORT_MAX_FILE_BYTES } from "@/modules/survey/import/limits";
import { qsfImportLane } from "@/modules/survey/import/qsf/lane";
import type { TSurveyImportStage } from "@/modules/survey/import/types";
import { SURVEY_IMPORT_HEARTBEAT_MS } from "./constants";
import { importTimedOutEvent, toSurveyImportStreamErrorEvent } from "./error-events";
import type { TSurveyImportStreamEvent } from "./events";

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

type TImportOutcome = "done" | "failed" | "timed_out" | "aborted";

/**
 * Read the upload and tell its type from its bytes, under the upload's limits: the file's size, then
 * what `sniffSurveyImportFile` checks (the zip limits for a `.docx` or `.xlsx`, the JSON budget for a
 * JSON file). Throws the refusals `toRefusalResponse` maps.
 */
const readUpload = async (file: File): Promise<TSurveyImportFile> => {
  if (file.size > SURVEY_IMPORT_MAX_FILE_BYTES) {
    throw new SurveyImportFileTooLargeError(
      "file_size",
      `The file must not exceed ${SURVEY_IMPORT_MAX_FILE_BYTES} bytes`
    );
  }
  return sniffSurveyImportFile(new Uint8Array(await file.arrayBuffer()));
};

/**
 * Import an uploaded survey file, streaming progress as NDJSON (ENG-3604, ENG-3653, ENG-6846,
 * ENG-6848). Every file type comes in the same way: the route's wrapper has already authenticated,
 * charged the default v3 bucket, read the multipart body within its byte limit and then taken a
 * concurrency slot. Here the workspace is checked first, then the file is read and its type told from its content,
 * and the file goes to its type's lane: a Formbricks file, a Qualtrics export, or a questionnaire from
 * Excel, CSV (ENG-6852) or Word (ENG-6853).
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

  let upload: TSurveyImportFile;
  try {
    upload = await readUpload(file);
  } catch (error) {
    const refusal = toRefusalResponse(error, requestId, instance);
    if (refusal) return refusal;

    logger
      .withContext({ requestId, workspaceId, organizationId })
      .error(
        { ...loggableError(error), operation: OPERATION, statusCode: 500 },
        "Survey import could not read the upload"
      );
    return problemInternalError(requestId, undefined, instance);
  }

  const lane = {
    req,
    authentication,
    organizationId,
    workspaceId,
    fileBytes: file.size,
    requestId,
    instance,
  };
  // The name the user's file had, for the report to show. Never a path, never stored.
  const fileName = file.name.trim();

  switch (upload.type) {
    case "qsf":
      return runSurveyImportLane({ ...lane, lane: qsfImportLane, input: { qsf: upload.json, fileName } });
    case "formbricks":
      return runSurveyImportLane({
        ...lane,
        lane: formbricksFileImportLane,
        input: {
          file: upload.json,
          fileName,
          workspaceId,
          organizationId,
          authentication,
        },
      });
    case "xlsx":
    case "csv":
    case "docx":
      return runSurveyImportLane({
        ...lane,
        lane: DOCUMENT_IMPORT_LANES[upload.type],
        input: { ...upload, fileName },
      });
  }
}

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
    const refusal = toRefusalResponse(error, requestId, instance);
    if (refusal) return refusal;

    // Not through mapV3ThrownError, which logs the error whole: a reader that fails on the file can
    // quote it in the message.
    log.error(
      { ...loggableError(error), operation: OPERATION, statusCode: 500 },
      "Survey import could not read the file"
    );
    return problemInternalError(requestId, undefined, instance);
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
      log.error(loggableAIError(error), "Survey import failed");
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

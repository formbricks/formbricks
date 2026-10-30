import "server-only";
import { logger } from "@formbricks/logger";
import { isClientAbort } from "@/app/api/internal/lib/ai-stream-errors";
import { createNdjsonResponse } from "@/app/api/internal/lib/ndjson-stream";
import { createRequestAbort } from "@/app/api/internal/lib/request-abort";
import { loggableAIError, mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { loggableError } from "@/app/api/v3/lib/loggable-error";
import { problemInternalError, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { getAITimeoutMs } from "@/lib/ai/timeout";
import { SurveyImportInputError, SurveyImportTimeoutError } from "@/modules/survey/import/core/errors";
import type { TSurveyImportLane, TSurveyImportResult } from "@/modules/survey/import/core/lane";
import { SURVEY_IMPORT_DEADLINE_MS } from "@/modules/survey/import/limits";
import type { TSurveyImportStage } from "@/modules/survey/import/types";
import { SURVEY_IMPORT_HEARTBEAT_MS } from "./constants";
import { importTimedOutEvent, toSurveyImportStreamErrorEvent } from "./error-events";
import type { TSurveyImportStreamEvent } from "./events";

const OPERATION = "surveys.import";

interface TStreamSurveyImportParams<TInput, TPrepared> {
  req: Request;
  authentication: TV3Authentication;
  workspaceId: string;
  /** The lane for the file's kind, and what it reads. */
  lane: TSurveyImportLane<TInput, TPrepared>;
  input: TInput;
  requestId: string;
  instance: string;
}

type TImportOutcome = "done" | "failed" | "timed_out" | "aborted";

const parseContentLength = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Import a survey file through its lane, streaming progress as NDJSON (ENG-3604, ENG-3653, ENG-6846).
 *
 * The ordering is the design: **every check that can answer with a problem response runs before the
 * response body opens** — workspace write access, the AI gate (for a lane that uses AI), and the
 * lane's file read — because once a 200 has started there is no way back to RFC 9457.
 * Authentication, rate limiting, the body limit and the concurrency slot already ran in the wrapper.
 * Only failures during the import itself become `error` events.
 *
 * Nothing is written: the dialog shows the draft for review and creates it with
 * `POST /api/v3/surveys?createdFrom=import`, which is what the audit log records.
 */
export async function streamSurveyImport<TInput, TPrepared>({
  req,
  authentication,
  workspaceId: requestedWorkspaceId,
  lane,
  input,
  requestId,
  instance,
}: TStreamSurveyImportParams<TInput, TPrepared>): Promise<Response> {
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
  const userId = getSessionUserId(authentication);
  const log = logger.withContext({ requestId, workspaceId, organizationId, sourceKind: lane.kind });

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
    prepared = lane.prepare(input);
  } catch (error) {
    if (error instanceof SurveyImportInputError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: error.invalidParams,
      });
    }

    // Not through mapV3ThrownError, which logs the error whole: a reader that fails on the file can
    // quote it in the message.
    log.error(
      { ...loggableError(error), operation: OPERATION, statusCode: 500 },
      "Survey import could not read the file"
    );
    return problemInternalError(requestId, undefined, instance);
  }

  const deadlineMs = getAITimeoutMs(SURVEY_IMPORT_DEADLINE_MS);
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

      emit({ type: "done", payload: result.payload, report: result.report });
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
          fileBytes: parseContentLength(req.headers.get("content-length")),
          questionCount: result?.report.summary.questions,
          inputTokens: result?.usage?.inputTokens,
          outputTokens: result?.usage?.outputTokens,
        },
        "Survey import finished"
      );
    },
  });
}

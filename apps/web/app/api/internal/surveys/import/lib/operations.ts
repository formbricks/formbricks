import "server-only";
import { classifyAIProviderError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { isClientAbort } from "@/app/api/internal/lib/ai-stream-errors";
import { createNdjsonResponse } from "@/app/api/internal/lib/ndjson-stream";
import { createRequestAbort } from "@/app/api/internal/lib/request-abort";
import { mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import {
  QsfImportInputError,
  type TPreparedQsfImport,
  type TQsfImportResult,
  prepareQsfImport,
  runQsfImport,
} from "@/modules/survey/import/qsf/pipeline";
import type { TQsfImportStage } from "@/modules/survey/import/types";
import { QSF_IMPORT_DEADLINE_MS, QSF_IMPORT_HEARTBEAT_MS } from "./constants";
import { importTimedOutEvent, toQsfImportStreamErrorEvent } from "./error-events";
import type { TQsfImportStreamEvent } from "./events";
import type { TQsfImportStreamBody } from "./schemas";

const OPERATION = "surveys.import";

interface TStreamQsfImportParams {
  req: Request;
  authentication: TV3Authentication;
  body: TQsfImportStreamBody;
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
 * Error fields that are safe to log. A provider error's message can echo the prompt, and the prompt
 * carries the file's questions, so those log only their name and status; anything else is our own
 * error and is logged whole.
 */
const loggableError = (error: unknown): Record<string, unknown> => {
  const providerError = classifyAIProviderError(error);
  if (!providerError) {
    return { err: error };
  }

  return {
    errName: error instanceof Error ? error.name : typeof error,
    ...(providerError.statusCode === undefined ? {} : { providerStatusCode: providerError.statusCode }),
  };
};

/**
 * Import a Qualtrics survey export, streaming progress as NDJSON (ENG-3604, ENG-3653).
 *
 * The ordering is the design: **every check that can answer with a problem response runs before the
 * response body opens** — workspace write access, the AI gate, and the file read — because once a 200
 * has started there is no way back to RFC 9457. Authentication, rate limiting, the body limit and the
 * concurrency slot already ran in the wrapper. Only failures during the import itself become `error`
 * events.
 *
 * Nothing is written: the dialog shows the draft for review and creates it with
 * `POST /api/v3/surveys?createdFrom=import`, which is what the audit log records.
 */
export async function streamQsfImport({
  req,
  authentication,
  body,
  requestId,
  instance,
}: TStreamQsfImportParams): Promise<Response> {
  const workspaceAccess = await requireV3WorkspaceAccess(
    authentication,
    body.workspaceId,
    "readWrite",
    requestId,
    instance
  );

  if (workspaceAccess instanceof Response) {
    return workspaceAccess;
  }

  const { organizationId, workspaceId } = workspaceAccess;
  const userId = getSessionUserId(authentication);
  const log = logger.withContext({ requestId, workspaceId, organizationId });

  try {
    await assertOrganizationAIConfigured(organizationId);
  } catch (error) {
    return (
      mapV3AIError(error, { requestId, instance, workspaceId, organizationId, operation: OPERATION }) ??
      mapV3ThrownError(error, { log, requestId, instance, operation: OPERATION })
    );
  }

  let prepared: TPreparedQsfImport;
  try {
    prepared = prepareQsfImport(body.qsf, body.fileName);
  } catch (error) {
    if (error instanceof QsfImportInputError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: error.invalidParams,
      });
    }

    return mapV3ThrownError(error, { log, requestId, instance, operation: OPERATION });
  }

  const importAbort = createRequestAbort(req, { deadlineMs: QSF_IMPORT_DEADLINE_MS });
  const startedAt = performance.now();
  let stage: TQsfImportStage = "reading";
  let outcome: TImportOutcome = "failed";
  let errorCode: string | undefined;
  let result: TQsfImportResult | undefined;

  return createNdjsonResponse<TQsfImportStreamEvent>({
    heartbeat: { intervalMs: QSF_IMPORT_HEARTBEAT_MS, event: () => ({ type: "progress", stage }) },
    produce: async (emit) => {
      const reportStage = (next: TQsfImportStage) => {
        stage = next;
        emit({ type: "progress", stage: next });
      };

      emit({ type: "start", requestId });
      reportStage("reading");

      result = await runQsfImport({
        prepared,
        workspaceId,
        organizationId,
        userId,
        signal: importAbort.signal,
        onProgress: reportStage,
      });

      emit({ type: "done", payload: result.payload, report: result.report });
      outcome = "done";
    },
    onError: (error) => {
      // Before the client-abort check: the deadline aborts the same signal, and a timeout is something
      // to tell the user, not a quiet exit.
      if (importAbort.deadlineExceeded()) {
        outcome = "timed_out";
        const event = importTimedOutEvent();
        errorCode = event.code;
        log.warn({ deadlineMs: QSF_IMPORT_DEADLINE_MS }, "QSF import hit its deadline");
        return event;
      }

      if (isClientAbort(error, importAbort.signal)) {
        // Pressing Stop is not an incident. The socket is gone, so there is nobody to tell either.
        outcome = "aborted";
        return null;
      }

      const event = toQsfImportStreamErrorEvent(error);
      errorCode = event.code;
      log.error(loggableError(error), "QSF import failed");
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
        "QSF import finished"
      );
    },
  });
}

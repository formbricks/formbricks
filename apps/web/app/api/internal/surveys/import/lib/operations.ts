import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemBadRequest } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { mapV3SurveyGenerateError } from "@/app/api/v3/surveys/generate/error-mapping";
import {
  assertAiImportAllowed,
  problemForImportDetectionFailure,
} from "@/app/api/v3/surveys/import/convert/lib/convert-import";
import type { TV3SurveyImportConvertBody } from "@/app/api/v3/surveys/import/convert/schemas";
import {
  guardImportWorkspaceBudget,
  problemImportInProgress,
} from "@/app/api/v3/surveys/import/lib/import-guards";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { capturePostHogEvent } from "@/lib/posthog";
import { detectImportSource } from "@/modules/survey/import/detect";
import { getImportLaneHandler } from "@/modules/survey/import/lanes";
import { ImportInProgressError, acquireAiImportSlot } from "@/modules/survey/import/lib/ai-inflight-guard";
import { resolveImportCandidate } from "@/modules/survey/import/resolve";
import {
  IMPORT_LANE_BY_KIND,
  type TImportContext,
  type TImportProgressStage,
  type TImportReportSource,
} from "@/modules/survey/import/types";
import {
  SURVEY_STREAM_RESPONSE_HEADERS,
  chainRequestAbort,
  encodeStreamEvent,
  isClientAbort,
  shouldEmitSnapshot,
  toStreamErrorEvent,
} from "../../lib/stream-events";
import type { TSurveyImportStreamEvent } from "./events";

interface TStreamImportParams {
  req: Request;
  authentication: TV3Authentication;
  body: TV3SurveyImportConvertBody;
  requestId: string;
  instance: string;
}

/**
 * Stream a file's conversion as NDJSON: progress per stage and per chunk, draft snapshots while the
 * model reads, the resolved document at the end.
 *
 * Same design as the generation stream: **every guard runs before the response body opens** —
 * workspace access, source detection, the AI gate and the shared AI budget (AI lane only). Once a 200
 * with a body has begun there is no way back to an RFC 9457 problem response, so only genuine
 * mid-conversion failures become in-band `error` events. Deterministic lanes emit start → progress
 * reading → progress validating → done with no partials.
 */
export async function streamImportConversion({
  req,
  authentication,
  body,
  requestId,
  instance,
}: TStreamImportParams): Promise<Response> {
  const workspaceAccess = await requireV3WorkspaceAccess(
    authentication,
    body.fields.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (workspaceAccess instanceof Response) {
    return workspaceAccess;
  }

  const { organizationId, workspaceId } = workspaceAccess;
  const userId = getSessionUserId(authentication);
  const importRunId = createId();
  const file = body.files[0];
  const budget = await guardImportWorkspaceBudget(workspaceId, requestId);
  if (budget) {
    return budget;
  }

  const detection = detectImportSource({
    fileName: file.fileName,
    mimeType: file.mimeType,
    bytes: file.bytes,
  });
  if (!detection.ok) {
    return problemForImportDetectionFailure(requestId, instance, detection.code);
  }
  const log = logger.withContext({
    requestId,
    importRunId,
    workspaceId,
    organizationId,
    sourceKind: detection.kind,
    lane: IMPORT_LANE_BY_KIND[detection.kind],
  });

  const lane = getImportLaneHandler(detection.kind);
  if (!lane) {
    return problemBadRequest(requestId, `Importing ${detection.kind} files is not available yet`, {
      instance,
      code: "lane_not_available",
      invalid_params: [{ name: "file", reason: `No import lane handles '${detection.kind}' files yet` }],
    });
  }

  const isAiLane = IMPORT_LANE_BY_KIND[detection.kind] === "ai";
  let releaseSlot: () => Promise<void> = async () => undefined;
  if (isAiLane) {
    try {
      await assertAiImportAllowed(organizationId, authentication);
      releaseSlot = await acquireAiImportSlot(userId ?? workspaceId);
    } catch (error) {
      if (error instanceof ImportInProgressError) {
        return problemImportInProgress(requestId, error, instance);
      }
      return mapV3SurveyGenerateError(error, { requestId, instance, workspaceId, organizationId });
    }
  }

  const source: TImportReportSource = {
    lane: IMPORT_LANE_BY_KIND[detection.kind],
    kind: detection.kind,
    fileName: file.fileName,
  };
  const { controller: abortController, detach } = chainRequestAbort(req);
  const startedAt = Date.now();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: TSurveyImportStreamEvent) => {
        if (closed) return;
        controller.enqueue(encodeStreamEvent(event));
      };

      emit({ type: "start", requestId, source });

      let seq = 0;
      let lastEmittedAt: number | null = null;
      let lastSerialized: string | null = null;
      let lastStage: TImportProgressStage | null = null;
      const progress = (event: Omit<Extract<TSurveyImportStreamEvent, { type: "progress" }>, "type">) => {
        // Deterministic lanes report nothing themselves; the orchestrator reports every stage. Either
        // way each stage transition goes out once, chunk steps as often as they happen.
        if (event.stage === lastStage && !event.chunk) return;
        lastStage = event.stage;
        emit({ type: "progress", ...event });
      };

      const ctx: TImportContext = {
        workspaceId,
        organizationId,
        userId,
        requestId,
        importRunId,
        languageHint: body.fields.language,
        signal: abortController.signal,
        onProgress: progress,
        onPartial: (draft, blockOffset) => {
          const serialized = JSON.stringify(draft);
          if (!shouldEmitSnapshot({ now: Date.now(), lastEmittedAt, serialized, lastSerialized })) return;
          seq += 1;
          lastEmittedAt = Date.now();
          lastSerialized = serialized;
          emit({ type: "partial", seq, draft, blockOffset });
        },
      };

      try {
        progress({ stage: "reading" });
        const candidate = await lane(
          { kind: detection.kind, fileName: file.fileName, content: { type: "bytes", bytes: file.bytes } },
          ctx
        );

        progress({ stage: "validating" });
        const resolved = await resolveImportCandidate(candidate, {
          workspaceId,
          organizationId,
          userId,
          requestId,
          dryRun: true,
        });

        emit({
          type: "done",
          payload: resolved.createBody,
          document: resolved.document,
          references: candidate.references ?? null,
          validation: resolved.validation,
          report: resolved.report,
        });

        if (isAiLane && userId && resolved.document) {
          capturePostHogEvent(
            userId,
            "ai_survey_imported",
            {
              source_kind: detection.kind,
              chunk_count: resolved.report.source.chunks ?? 1,
              question_count: resolved.report.summary.elements,
              language_count: resolved.report.summary.languages.length,
              chars: file.bytes.byteLength,
              duration_ms: Date.now() - startedAt,
              streamed: true,
            },
            { organizationId, workspaceId }
          );
        }
      } catch (error) {
        if (isClientAbort(error, abortController.signal)) {
          log.info("Survey import stream aborted by the client");
        } else {
          log.error({ err: error }, "Survey import stream failed");
          emit({ ...toStreamErrorEvent(error), reference: importRunId });
        }
      } finally {
        detach();
        await releaseSlot();
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      abortController.abort();
      void releaseSlot();
      log.info("Survey import stream cancelled by the client");
    },
  });

  return new Response(stream, { status: 200, headers: SURVEY_STREAM_RESPONSE_HEADERS });
}

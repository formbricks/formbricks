import "server-only";
import type { z } from "zod";
import type { TStreamObjectResult } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { mapV3SurveyGenerateError } from "@/app/api/v3/surveys/generate/error-mapping";
import type {
  TV3SurveyGenerateBody,
  ZGeneratedSurveyDraftForAI,
} from "@/app/api/v3/surveys/generate/schemas";
import {
  assertV3SurveyGeneratePrompt,
  buildV3SurveyCreatePayloadFromDraft,
  buildV3SurveyGenerationRequest,
  buildV3SurveyGenerationTracing,
} from "@/app/api/v3/surveys/generate/service";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { assertOrganizationAIConfigured, streamOrganizationAIObject } from "@/lib/ai/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { isClientAbort, toStreamErrorEvent } from "./error-events";
import {
  SURVEY_GENERATION_STREAM_CONTENT_TYPE,
  type TSurveyGenerationDraftSnapshot,
  type TSurveyGenerationStreamEvent,
  encodeStreamEvent,
  shouldEmitSnapshot,
} from "./events";

interface TStreamSurveyGenerationParams {
  req: Request;
  authentication: TV3Authentication;
  body: TV3SurveyGenerateBody;
  requestId: string;
  instance: string;
}

/**
 * Stream a survey draft as the model writes it, as NDJSON.
 *
 * The ordering here is the whole design: **every guard runs before the response body opens.** Once
 * a 200 with a body has begun there is no way back to an RFC 9457 problem response, so entitlement
 * and prompt validation are hoisted ahead of the stream and only genuine mid-generation failures
 * become in-band `error` events.
 */
export async function streamV3SurveyGeneration({
  req,
  authentication,
  body,
  requestId,
  instance,
}: TStreamSurveyGenerationParams): Promise<Response> {
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
    assertV3SurveyGeneratePrompt(body.prompt);
    // Hoisted out of streamOrganizationAIObject on purpose: an unentitled organization has to get a
    // problem+json, not a 200 carrying an error event.
    await assertOrganizationAIConfigured(organizationId);
  } catch (error) {
    return mapV3SurveyGenerateError(error, { requestId, instance, workspaceId, organizationId });
  }

  // Chained to req.signal (Next aborts that on client disconnect) but abortable by cancel() too,
  // which can fire first and would otherwise leave the provider running to its 45s timeout.
  const generationAbort = new AbortController();
  const abortGeneration = () => generationAbort.abort();
  // An abort that already happened is never replayed to a listener added afterwards, so a client
  // that disconnected during the guards above would otherwise get a full generation billed to it.
  if (req.signal.aborted) abortGeneration();
  else req.signal.addEventListener("abort", abortGeneration, { once: true });

  let generation: TStreamObjectResult<z.infer<typeof ZGeneratedSurveyDraftForAI>>;
  try {
    generation = await streamOrganizationAIObject({
      organizationId,
      aiTracing: buildV3SurveyGenerationTracing({ workspaceId, userId }),
      ...buildV3SurveyGenerationRequest(body),
      // Next derives this from the client socket closing, so pressing Stop aborts the provider call
      // itself rather than just detaching the reader — this is what stops the spend.
      abortSignal: generationAbort.signal,
    });
  } catch (error) {
    return mapV3SurveyGenerateError(error, { requestId, instance, workspaceId, organizationId });
  }

  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: TSurveyGenerationStreamEvent) => {
        if (closed) return;
        controller.enqueue(encodeStreamEvent(event));
      };

      emit({ type: "start", requestId });

      let seq = 0;
      let lastEmittedAt: number | null = null;
      let lastSerialized: string | null = null;
      let lastSnapshot: TSurveyGenerationDraftSnapshot | null = null;

      try {
        for await (const snapshot of generation.partialObjectStream) {
          lastSnapshot = snapshot;
          const serialized = JSON.stringify(snapshot);
          if (!shouldEmitSnapshot({ now: Date.now(), lastEmittedAt, serialized, lastSerialized })) {
            continue;
          }

          seq += 1;
          lastEmittedAt = Date.now();
          lastSerialized = serialized;
          emit({ type: "partial", seq, draft: snapshot });
        }

        const draft = await generation.completion;

        // Always land the final snapshot, whatever the throttle said, so the list the user is
        // reading matches the draft the review step is about to act on.
        const finalSerialized = JSON.stringify(lastSnapshot);
        if (lastSnapshot && finalSerialized !== lastSerialized) {
          seq += 1;
          emit({ type: "partial", seq, draft: lastSnapshot });
        }

        const result = buildV3SurveyCreatePayloadFromDraft(body, draft);
        emit({ type: "done", ...result });

        if (userId) {
          capturePostHogEvent(
            userId,
            "ai_survey_generated",
            { prompt_length: body.prompt.length, streamed: true },
            { organizationId, workspaceId }
          );
        }
      } catch (error) {
        if (isClientAbort(error, generationAbort.signal)) {
          // A user pressing Stop is not an incident and must not page anyone. The socket is already
          // gone, so there is nothing to tell them either.
          log.info("AI survey generation aborted by the client");
        } else {
          log.error({ err: error }, "AI survey generation stream failed");
          // Enqueue the error and close cleanly. controller.error() would truncate the response and
          // the client would see a bare network failure with none of the code this event carries.
          emit(toStreamErrorEvent(error));
        }
      } finally {
        req.signal.removeEventListener("abort", abortGeneration);
        // close() throws on a stream the consumer already cancelled, and there is nobody left to
        // tell either way.
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      // Next aborts its pipeTo on disconnect, which lands here — sometimes before the loop above
      // observes req.signal. Mark the stream closed first so no in-flight emit enqueues into it.
      closed = true;
      abortGeneration();
      log.info("AI survey generation stream cancelled by the client");
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": SURVEY_GENERATION_STREAM_CONTENT_TYPE,
      // no-transform is the RFC 9111 signal that forbids an intermediary coalescing or re-encoding
      // the body; X-Accel-Buffering is for self-hosters fronting Formbricks with nginx-ingress,
      // where proxy_buffering is on by default and would hold the whole response.
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

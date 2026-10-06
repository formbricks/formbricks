import "server-only";
import type { z } from "zod";
import type { TStreamObjectResult } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { isClientAbort } from "@/app/api/internal/lib/ai-stream-errors";
import { createNdjsonResponse } from "@/app/api/internal/lib/ndjson-stream";
import { createRequestAbort } from "@/app/api/internal/lib/request-abort";
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
import { toStreamErrorEvent } from "./error-events";
import {
  type TSurveyGenerationDraftSnapshot,
  type TSurveyGenerationStreamEvent,
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

  // Pressing Stop aborts the provider call itself rather than just detaching the reader — this is
  // what stops the spend. Abortable from the stream's cancel() too, which can fire before req.signal.
  const generationAbort = createRequestAbort(req);

  let generation: TStreamObjectResult<z.infer<typeof ZGeneratedSurveyDraftForAI>>;
  try {
    generation = await streamOrganizationAIObject({
      organizationId,
      aiTracing: buildV3SurveyGenerationTracing({ workspaceId, userId }),
      ...buildV3SurveyGenerationRequest(body),
      abortSignal: generationAbort.signal,
    });
  } catch (error) {
    generationAbort.dispose();
    return mapV3SurveyGenerateError(error, { requestId, instance, workspaceId, organizationId });
  }

  return createNdjsonResponse<TSurveyGenerationStreamEvent>({
    produce: async (emit) => {
      emit({ type: "start", requestId });

      let seq = 0;
      let lastEmittedAt: number | null = null;
      let lastSerialized: string | null = null;

      for await (const snapshot of generation.partialObjectStream) {
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

      // Always land the completed draft as the final snapshot, whatever the throttle said. Not the
      // last partial: that one is a `DeepPartial` and can be missing fields the finished object
      // has, and the review step renders this while saving uses the payload — so the two would
      // disagree. It also covers a provider that streams no partials at all, where the review step
      // would otherwise open on an empty list.
      const finalDraft = draft as TSurveyGenerationDraftSnapshot;
      if (JSON.stringify(finalDraft) !== lastSerialized) {
        seq += 1;
        emit({ type: "partial", seq, draft: finalDraft });
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
    },
    onError: (error) => {
      if (isClientAbort(error, generationAbort.signal)) {
        // A user pressing Stop is not an incident and must not page anyone. The socket is already
        // gone, so there is nothing to tell them either.
        log.info("AI survey generation aborted by the client");
        return null;
      }

      log.error({ err: error }, "AI survey generation stream failed");
      return toStreamErrorEvent(error);
    },
    onCancel: () => {
      generationAbort.abort();
      log.info("AI survey generation stream cancelled by the client");
    },
    onSettled: generationAbort.dispose,
  });
}

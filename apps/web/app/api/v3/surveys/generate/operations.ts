import "server-only";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSessionUserId } from "../lib/operations";
import { mapV3SurveyGenerateError } from "./error-mapping";
import type { TV3SurveyGenerateBody } from "./schemas";
import { generateV3SurveyCreatePayloadFromPrompt } from "./service";

/**
 * `POST /api/v3/surveys/generate` → 200 `{ data: { language, payload, validation } }`, and the
 * `generate_survey` MCP tool. Generates a survey draft from a prompt and persists nothing: the caller
 * saves the draft with `POST /api/v3/surveys` (`create_survey`).
 *
 * The AI budget (10 per minute per user or API key) is charged here rather than by the route wrapper,
 * because the wrapper never sees an MCP call. REST and MCP charge the same principal in the same
 * namespace, and so does the session-only streaming route, so every entry point spends from one bucket.
 * It is charged before the workspace check, as the wrapper did, so refused attempts count too.
 *
 * The organization's AI toggle, the license entitlement and the provider configuration are checked by
 * `generateOrganizationAIObject` inside the service; each failure maps to its own AI error code.
 */
export async function generateV3Survey({
  authentication,
  body,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  body: TV3SurveyGenerateBody;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const limited = await applyV3OperationRateLimit({
    config: rateLimitConfigs.api.v3SurveyGenerate,
    authentication,
    requestId,
    instance,
  });
  if (limited) return limited;

  const workspaceAccess = await requireV3WorkspaceAccess(
    authentication,
    body.workspaceId,
    "readWrite",
    requestId,
    instance
  );
  if (workspaceAccess instanceof Response) return workspaceAccess;

  const { organizationId, workspaceId } = workspaceAccess;

  try {
    const userId = getSessionUserId(authentication);
    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId,
      workspaceId,
      userId,
      input: body,
    });

    if (userId) {
      capturePostHogEvent(
        userId,
        "ai_survey_generated",
        { prompt_length: body.prompt.length },
        { organizationId, workspaceId }
      );
    }

    return successResponse(result, { requestId });
  } catch (error) {
    return mapV3SurveyGenerateError(error, {
      requestId,
      instance,
      workspaceId: body.workspaceId,
      organizationId,
    });
  }
}

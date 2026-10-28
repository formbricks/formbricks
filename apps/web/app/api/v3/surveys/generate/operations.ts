import "server-only";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { getSessionUserId } from "../lib/operations";
import { mapV3SurveyGenerateError } from "./error-mapping";
import type { TV3SurveyGenerateBody } from "./schemas";
import { generateV3SurveyCreatePayloadFromPrompt } from "./service";

/**
 * `POST /api/v3/surveys/generate`: draft a survey create payload from a prompt with the organization's AI
 * provider. Nothing is stored; the caller sends `payload` to the create operation to keep it.
 *
 * Needs read-write access to the workspace. The AI gate (plan, smart tools switch, configured instance)
 * and the provider or Formbricks quota are enforced inside the call and come back as problem responses.
 * The per-actor rate limit is the caller's to apply: the route does it in its wrapper, the MCP tool itself.
 */
export async function generateV3Survey({
  authentication,
  body,
  requestId,
  instance,
}: Readonly<{
  authentication: TV3Authentication;
  body: TV3SurveyGenerateBody;
  requestId: string;
  instance: string;
}>): Promise<Response> {
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

  try {
    const userId = getSessionUserId(authentication);
    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: workspaceAccess.organizationId,
      workspaceId: workspaceAccess.workspaceId,
      userId,
      input: body,
    });

    if (userId) {
      capturePostHogEvent(
        userId,
        "ai_survey_generated",
        { prompt_length: body.prompt.length },
        { organizationId: workspaceAccess.organizationId, workspaceId: workspaceAccess.workspaceId }
      );
    }

    return successResponse(result, { requestId });
  } catch (error) {
    return mapV3SurveyGenerateError(error, {
      requestId,
      instance,
      workspaceId: body.workspaceId,
      organizationId: workspaceAccess.organizationId,
    });
  }
}

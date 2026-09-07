import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { successResponse } from "@/app/api/v3/lib/response";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSessionUserId } from "../lib/operations";
import { mapV3SurveyGenerateError } from "./error-mapping";
import { ZV3SurveyGenerateBody } from "./schemas";
import { generateV3SurveyCreatePayloadFromPrompt } from "./service";

export const POST = withV3ApiWrapper({
  auth: "both",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  schemas: {
    body: ZV3SurveyGenerateBody,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    const { body } = parsedInput;
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
  },
});

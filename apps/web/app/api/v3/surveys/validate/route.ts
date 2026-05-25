import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import { getAuthorizedV3Survey } from "../authorization";
import {
  type TV3SurveyPrepareResult,
  prepareV3SurveyCreateInput,
  prepareV3SurveyPatchInput,
} from "../prepare";
import { type TV3SurveyDocument, ZV3EmptyQuery, ZV3SurveyValidationRequestBody } from "../schemas";

const createWorkspaceSchema = z.object({
  workspaceId: z.cuid2(),
});

function serializeValidationResult<TDocument extends TV3SurveyDocument>(
  operation: "create" | "patch",
  preparation: TV3SurveyPrepareResult<TDocument>
) {
  if (!preparation.ok) {
    return {
      valid: false,
      operation,
      invalid_params: preparation.validation.invalidParams,
    };
  }

  return {
    valid: true,
    operation,
    invalid_params: [],
    languages: preparation.languageRequests.map((languageRequest) => ({
      ...languageRequest,
      writeBehavior: "connect_or_create" as const,
    })),
  };
}

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZV3SurveyValidationRequestBody,
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const { body } = parsedInput;
    const log = logger.withContext({ requestId, operation: body.operation });

    try {
      if (body.operation === "create") {
        const workspaceResult = createWorkspaceSchema.safeParse(body.data);
        if (workspaceResult.success) {
          const authResult = await requireV3WorkspaceAccess(
            authentication,
            workspaceResult.data.workspaceId,
            "readWrite",
            requestId,
            instance
          );

          if (authResult instanceof Response) {
            return authResult;
          }
        }

        return successResponse(serializeValidationResult("create", prepareV3SurveyCreateInput(body.data)), {
          requestId,
          cache: "private, no-store",
        });
      }

      const { survey, response } = await getAuthorizedV3Survey({
        surveyId: body.surveyId,
        authentication,
        access: "readWrite",
        requestId,
        instance,
      });

      if (response) {
        log.warn(
          { statusCode: response.status, surveyId: body.surveyId },
          "Survey not found or not accessible"
        );
        return response;
      }

      return successResponse(
        serializeValidationResult("patch", prepareV3SurveyPatchInput(survey, body.data)),
        {
          requestId,
          cache: "private, no-store",
        }
      );
    } catch (error) {
      if (error instanceof DatabaseError) {
        log.error({ error, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, statusCode: 500 }, "V3 survey validation unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

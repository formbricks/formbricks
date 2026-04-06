import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { checkPermissionIfNeeded, resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getSurvey } from "@/lib/survey/service";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { resolveStorageUrlsInObject, validateFileUploads } from "@/modules/storage/utils";
import { createResponseWithQuotaEvaluation, getResponses, getResponsesByWorkspaceIds } from "./lib/response";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const searchParams = req.nextUrl.searchParams;
    const surveyId = searchParams.get("surveyId");
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("skip") ? Number(searchParams.get("skip")) : undefined;

    try {
      let allResponses: TResponse[] = [];

      if (surveyId) {
        const survey = await getSurvey(surveyId);
        if (!survey) {
          return {
            response: responses.notFoundResponse("Survey", surveyId, true),
          };
        }
        if (!hasPermission(authentication.environmentPermissions, survey.workspaceId, "GET")) {
          return {
            response: responses.unauthorizedResponse(),
          };
        }
        const surveyResponses = await getResponses(surveyId, limit, offset);
        allResponses.push(...surveyResponses);
      } else {
        const workspaceIds = [
          ...new Set(authentication.environmentPermissions.map((permission) => permission.workspaceId)),
        ];
        const workspaceResponses = await getResponsesByWorkspaceIds(workspaceIds, limit, offset);
        allResponses.push(...workspaceResponses);
      }
      return {
        response: responses.successResponse(
          allResponses.map((r) => ({ ...r, data: resolveStorageUrlsInObject(r.data) }))
        ),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      throw error;
    }
  },
});

const validateSurvey = async (responseInput: TResponseInput, workspaceId: string) => {
  const survey = await getSurvey(responseInput.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", responseInput.surveyId, true) };
  }
  if (survey.workspaceId !== workspaceId) {
    return {
      error: responses.badRequestResponse(
        "Survey is part of another workspace",
        {
          "survey.workspaceId": survey.workspaceId,
          workspaceId,
        },
        true
      ),
    };
  }
  return { survey };
};

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      let jsonInput;
      try {
        jsonInput = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      // Accept workspaceId as alternative to environmentId — resolve to production environment
      const resolved = await resolveBodyIds(jsonInput, authentication.environmentPermissions, "POST");
      if (!resolved.ok) return { response: resolved.response };

      const inputValidation = ZResponseInput.safeParse(resolved.body);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }

      const responseInput = inputValidation.data;

      const permDenied = checkPermissionIfNeeded(
        resolved.alreadyAuthorized,
        authentication.environmentPermissions,
        responseInput.workspaceId,
        "POST"
      );
      if (permDenied) return { response: permDenied };

      const surveyResult = await validateSurvey(responseInput, responseInput.workspaceId);
      if (surveyResult.error) {
        return {
          response: surveyResult.error,
        };
      }

      if (!validateFileUploads(responseInput.data, surveyResult.survey.questions)) {
        return {
          response: responses.badRequestResponse("Invalid file upload response"),
        };
      }

      // Validate response data against validation rules
      const validationErrors = validateResponseData(
        surveyResult.survey.blocks,
        responseInput.data,
        responseInput.language ?? "en",
        surveyResult.survey.questions
      );

      if (validationErrors) {
        return {
          response: responses.badRequestResponse(
            "Validation failed",
            formatValidationErrorsForV1Api(validationErrors),
            true
          ),
        };
      }

      if (responseInput.createdAt && !responseInput.updatedAt) {
        responseInput.updatedAt = responseInput.createdAt;
      }

      try {
        const response = await createResponseWithQuotaEvaluation(responseInput);
        if (auditLog) {
          auditLog.targetId = response.id;
          auditLog.newObject = response;
        }

        sendToPipeline({
          event: "responseCreated",
          environmentId: surveyResult.survey.environmentId,
          workspaceId: surveyResult.survey.workspaceId,
          surveyId: response.surveyId,
          response: response,
        });

        if (response.finished) {
          sendToPipeline({
            event: "responseFinished",
            environmentId: surveyResult.survey.environmentId,
            workspaceId: surveyResult.survey.workspaceId,
            surveyId: response.surveyId,
            response: response,
          });
        }

        return {
          response: responses.successResponse(response, true),
        };
      } catch (error) {
        logger.error({ error, url: req.url }, "Error in POST /api/v1/management/responses");

        if (error instanceof InvalidInputError) {
          return {
            response: responses.badRequestResponse(error.message),
          };
        }

        return {
          response: responses.internalServerErrorResponse(
            error instanceof Error ? error.message : "Unknown error occurred"
          ),
        };
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.badRequestResponse("An unexpected error occurred while creating the response"),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "response",
});

import { logger } from "@formbricks/logger";
import { TResponseData, ZResponseUpdateInput } from "@formbricks/types/responses";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiV1Authentication, THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { deleteResponse, getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getWorkspaceLegacyStoragePrefixes } from "@/lib/workspace/service";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { hasApiKeyWorkspaceAccess } from "@/modules/organization/settings/api-keys/lib/utils";
import { resolveStorageUrlsInObject, validateClientFileUploads } from "@/modules/storage/utils";
import { updateResponseWithQuotaEvaluation } from "./lib/response";

type TUncheckedResponseUpdate = Record<string, unknown> & {
  data: TResponseData;
  language?: string;
};

async function fetchAndAuthorizeResponse(
  responseId: string,
  authentication: TApiV1Authentication | undefined,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  if (!authentication || !("apiKeyId" in authentication)) {
    return { error: responses.notAuthenticatedResponse() };
  }

  const response = await getResponse(responseId);
  if (!response) {
    return { error: responses.notFoundResponse("Response", responseId) };
  }

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", response.surveyId, true) };
  }

  if (!(await hasApiKeyWorkspaceAccess(authentication, survey.workspaceId, requiredPermission))) {
    return { error: responses.unauthorizedResponse() };
  }

  return { response, survey };
}

export const GET = withV1ApiWrapper({
  handler: async ({ props, authentication }: THandlerParams<{ params: Promise<{ responseId: string }> }>) => {
    const params = await props.params;
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "GET");
      if (result.error) {
        return {
          response: result.error,
        };
      }

      return {
        response: responses.successResponse({
          ...result.response,
          data: resolveStorageUrlsInObject(result.response.data),
        }),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ responseId: string }> }>) => {
    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.responseId;
    }
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.response;
      }

      const deletedResponse = await deleteResponse(params.responseId);
      return {
        response: responses.successResponse(deletedResponse),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "deleted",
  targetType: "response",
});

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ responseId: string }> }>) => {
    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.responseId;
    }
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.response;
      }

      let responseUpdate: TUncheckedResponseUpdate;
      try {
        responseUpdate = await parseJsonBodyWithLimit<TUncheckedResponseUpdate>(req);
      } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
          return {
            response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }),
          };
        }

        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      if (
        !validateClientFileUploads({
          data: responseUpdate.data,
          workspaceId: result.survey.workspaceId,
          surveyId: result.survey.id,
          blocks: result.survey.blocks,
          questions: result.survey.questions,
          // Management callers replay stored responses whose file URLs may predate the scoped shape;
          // accept those against a prefix this workspace owns (ENG-1981 review).
          legacyOwnedStoragePrefixes: await getWorkspaceLegacyStoragePrefixes(result.survey.workspaceId),
        })
      ) {
        return {
          response: responses.badRequestResponse(
            "Invalid file upload response: each file URL must reference a file uploaded to this survey's file-upload element"
          ),
        };
      }

      // Validate response data against validation rules
      const validationErrors = validateResponseData(
        result.survey.blocks,
        responseUpdate.data,
        responseUpdate.language ?? "en",
        result.survey.questions
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

      const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }

      const updated = await updateResponseWithQuotaEvaluation(params.responseId, inputValidation.data);
      if (auditLog) {
        auditLog.newObject = updated;
      }

      await sendToPipeline({
        event: "responseUpdated",
        workspaceId: result.survey.workspaceId,
        surveyId: result.survey.id,
        response: updated,
      });

      if (updated.finished) {
        await sendToPipeline({
          event: "responseFinished",
          workspaceId: result.survey.workspaceId,
          surveyId: result.survey.id,
          response: updated,
        });
      }

      return {
        response: responses.successResponse({ ...updated, data: resolveStorageUrlsInObject(updated.data) }),
      };
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "updated",
  targetType: "response",
});

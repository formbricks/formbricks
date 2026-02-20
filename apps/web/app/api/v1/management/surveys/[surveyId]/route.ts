import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ZSurveyUpdateInput } from "@formbricks/types/surveys/types";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { deleteSurvey } from "@/app/api/v1/management/surveys/[surveyId]/lib/surveys";
import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import { responses } from "@/app/lib/api/response";
import {
  transformBlocksToQuestions,
  transformQuestionsToBlocks,
  validateSurveyInput,
} from "@/app/lib/api/survey-transformation";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";

const fetchAndAuthorizeSurvey = async (
  surveyId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", surveyId) };
  }
  if (!hasPermission(authentication.environmentPermissions, survey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { survey };
};

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: {
    props: { params: Promise<{ surveyId: string }> };
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;

    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "GET");
      if (result.error) {
        return {
          response: result.error,
        };
      }

      const shouldTransformToQuestions =
        result.survey.blocks &&
        result.survey.blocks.length > 0 &&
        result.survey.blocks.every((block) => block.elements.length === 1);

      if (shouldTransformToQuestions) {
        return {
          response: responses.successResponse(
            resolveStorageUrlsInObject({
              ...result.survey,
              questions: transformBlocksToQuestions(result.survey.blocks, result.survey.endings),
              blocks: [],
            })
          ),
        };
      }

      return {
        response: responses.successResponse(resolveStorageUrlsInObject(result.survey)),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: {
    props: { params: Promise<{ surveyId: string }> };
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.surveyId;
    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.survey;

      const deletedSurvey = await deleteSurvey(params.surveyId);
      return {
        response: responses.successResponse(deletedSurvey),
      };
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  action: "deleted",
  targetType: "survey",
});

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: {
    req: NextRequest;
    props: { params: Promise<{ surveyId: string }> };
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.surveyId;
    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      auditLog.oldObject = result.survey;

      const organization = await getOrganizationByEnvironmentId(result.survey.environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      let surveyUpdate;
      try {
        surveyUpdate = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON input");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      const validateResult = validateSurveyInput({ ...surveyUpdate, updateOnly: true });
      if (!validateResult.ok) {
        return {
          response: responses.badRequestResponse(validateResult.error.message),
        };
      }

      const { hasQuestions } = validateResult.data;

      if (hasQuestions) {
        surveyUpdate.blocks = transformQuestionsToBlocks(
          surveyUpdate.questions,
          surveyUpdate.endings || result.survey.endings
        );
        surveyUpdate.questions = [];
      }

      const inputValidation = ZSurveyUpdateInput.safeParse({
        ...result.survey,
        ...surveyUpdate,
      });

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error)
          ),
        };
      }

      const featureCheckResult = await checkFeaturePermissions(surveyUpdate, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      try {
        const updatedSurvey = await updateSurvey({ ...inputValidation.data, id: params.surveyId });
        auditLog.newObject = updatedSurvey;

        if (hasQuestions) {
          const surveyWithQuestions = {
            ...updatedSurvey,
            questions: transformBlocksToQuestions(updatedSurvey.blocks, updatedSurvey.endings),
            blocks: [],
          };

          return {
            response: responses.successResponse(resolveStorageUrlsInObject(surveyWithQuestions)),
          };
        }

        return {
          response: responses.successResponse(resolveStorageUrlsInObject(updatedSurvey)),
        };
      } catch (error) {
        return {
          response: handleErrorResponse(error),
        };
      }
    } catch (error) {
      return {
        response: handleErrorResponse(error),
      };
    }
  },
  action: "updated",
  targetType: "survey",
});

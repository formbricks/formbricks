import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { ZSurveyCreateInputWithEnvironmentId } from "@formbricks/types/surveys/types";
import {
  checkEnvPermissionIfNeeded,
  resolveWorkspaceInBody,
} from "@/app/api/v1/management/lib/workspace-resolver";
import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import {
  addLegacyProjectOverwrites,
  addLegacyProjectOverwritesToList,
  normaliseProjectOverwritesToWorkspace,
} from "@/app/lib/api/api-backwards-compat";
import { responses } from "@/app/lib/api/response";
import {
  transformBlocksToQuestions,
  transformQuestionsToBlocks,
  validateSurveyInput,
} from "@/app/lib/api/survey-transformation";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { createSurvey } from "@/lib/survey/service";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { getSurveys } from "./lib/surveys";

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const searchParams = new URL(req.url).searchParams;
      const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
      const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

      const workspaceIds = [
        ...new Set(authentication.environmentPermissions.map((permission) => permission.workspaceId)),
      ];

      const surveys = await getSurveys(workspaceIds, limit, offset);

      const surveysWithQuestions = surveys.map((survey) => {
        // If the survey has blocks and each block has ONLY ONE element, we can transform the blocks to questions
        // This is only for backwards compatibility with the older surveys
        const shouldTransformToQuestions =
          survey.blocks &&
          survey.blocks.length > 0 &&
          survey.blocks.every((block) => block.elements.length === 1);

        if (shouldTransformToQuestions) {
          return {
            ...survey,
            questions: transformBlocksToQuestions(survey.blocks, survey.endings),
            blocks: [],
          };
        }

        return survey;
      });

      return {
        response: responses.successResponse(
          addLegacyProjectOverwritesToList(resolveStorageUrlsInObject(surveysWithQuestions))
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

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      let surveyInput;
      try {
        surveyInput = await req.json();
      } catch (error) {
        logger.error({ error, url: req.url }, "Error parsing JSON");
        return {
          response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
        };
      }

      // Backwards compat: accept projectOverwrites as alias for workspaceOverwrites
      surveyInput = normaliseProjectOverwritesToWorkspace(surveyInput);

      // Accept workspaceId as alternative to environmentId — resolve to production environment
      const resolved = await resolveWorkspaceInBody(
        surveyInput,
        authentication.environmentPermissions,
        "POST"
      );
      if (!resolved.ok) return { response: resolved.response };
      surveyInput = resolved.body;

      const inputValidation = ZSurveyCreateInputWithEnvironmentId.safeParse(surveyInput);

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }

      const { environmentId } = inputValidation.data;

      const permDenied = checkEnvPermissionIfNeeded(
        resolved.alreadyAuthorized,
        authentication.environmentPermissions,
        environmentId,
        "POST"
      );
      if (permDenied) return { response: permDenied };

      const organization = await getOrganizationByEnvironmentId(environmentId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      const surveyData = { ...inputValidation.data, environmentId };

      const validateResult = validateSurveyInput(surveyData);
      if (!validateResult.ok) {
        return {
          response: responses.badRequestResponse(validateResult.error.message),
        };
      }

      const { hasQuestions } = validateResult.data;

      if (hasQuestions) {
        surveyData.blocks = transformQuestionsToBlocks(surveyData.questions, surveyData.endings || []);
        surveyData.questions = [];
      }

      const featureCheckResult = await checkFeaturePermissions(surveyData, organization);
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      const survey = await createSurvey(environmentId, { ...surveyData, environmentId: undefined });
      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.newObject = survey;
      }

      if (hasQuestions) {
        const surveyWithQuestions = {
          ...survey,
          questions: transformBlocksToQuestions(survey.blocks, survey.endings),
          blocks: [],
        };

        return {
          response: responses.successResponse(addLegacyProjectOverwrites(surveyWithQuestions)),
        };
      }

      return {
        response: responses.successResponse(addLegacyProjectOverwrites(survey)),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "survey",
});

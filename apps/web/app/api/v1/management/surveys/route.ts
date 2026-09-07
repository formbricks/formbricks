import { logger } from "@formbricks/logger";
import { ZSurveyCreateInputWithWorkspaceId } from "@formbricks/types/surveys/types";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { checkFeaturePermissions } from "@/app/api/v1/management/surveys/lib/utils";
import {
  addLegacyProjectOverwrites,
  addLegacyProjectOverwritesToList,
  normaliseProjectOverwritesToWorkspace,
} from "@/app/lib/api/api-backwards-compat";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import {
  addLegacyEnvironmentIdBestEffort,
  addLegacyEnvironmentIdToList,
} from "@/app/lib/api/legacy-environment-id";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import {
  transformQuestionsToBlocks,
  validateSurveyInput,
  withDerivedQuestions,
} from "@/app/lib/api/survey-transformation";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurvey } from "@/lib/survey/service";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { getSurveys } from "./lib/surveys";

export const GET = withV1ApiWrapper({
  allowOrganizationOnlyApiKey: true,
  handler: async ({ req, authentication }) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const searchParams = new URL(req.url).searchParams;
      const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
      const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      const surveys = await getSurveys(workspaceIds, limit, offset);

      // Always expose `questions` (derived from blocks) alongside `blocks` so API v1
      // consumers get a consistent shape regardless of how the survey was built.
      const surveysWithQuestions = surveys.map((survey) => withDerivedQuestions(survey));

      return {
        response: responses.successResponse(
          await addLegacyEnvironmentIdToList(
            addLegacyProjectOverwritesToList(resolveStorageUrlsInObject(surveysWithQuestions))
          )
        ),
      };
    } catch (error) {
      return handleApiError(error);
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
        surveyInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
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

      // Backwards compat: accept projectOverwrites as alias for workspaceOverwrites
      surveyInput = normaliseProjectOverwritesToWorkspace(surveyInput);

      // Accept workspaceId as alternative to environmentId — resolve to production environment
      const resolved = await resolveBodyIds(surveyInput, authentication, "POST");
      if (!resolved.ok) return { response: resolved.response };
      surveyInput = resolved.body;

      const inputValidation = ZSurveyCreateInputWithWorkspaceId.safeParse(surveyInput);

      if (!inputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(inputValidation.error),
            true
          ),
        };
      }

      const { workspaceId } = inputValidation.data;

      if (
        !resolved.alreadyAuthorized &&
        !(await can(
          { type: "apiKey", id: authentication.apiKeyId },
          getWorkspaceAuthorizationActionForMethod("POST"),
          { type: "workspace", id: workspaceId }
        ))
      ) {
        return { response: responses.unauthorizedResponse() };
      }

      const organization = await getOrganizationByWorkspaceId(workspaceId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      const surveyData = { ...inputValidation.data };

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

      const { workspaceId: __, ...surveyCreateInput } = surveyData;
      const survey = await createSurvey(workspaceId, surveyCreateInput);
      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.newObject = survey;
      }

      return {
        // Best-effort, not strict: the insert has committed by now, so a failed workspace lookup here
        // would return an error for a survey that exists. `Survey` has no unique constraint to dedup
        // on, so a client retrying that false error creates a second survey.
        response: responses.successResponse(
          await addLegacyEnvironmentIdBestEffort(
            addLegacyProjectOverwrites(resolveStorageUrlsInObject(withDerivedQuestions(survey)))
          )
        ),
      };
    } catch (error) {
      // Invalid survey media (e.g. an unsupported/unparseable choice imageUrl) surfaces as an
      // InvalidInputError, which handleApiError returns as a 400 with its message instead of a 500
      // that would page Sentry. DatabaseError and unexpected errors become a generic, reported 500.
      return handleApiError(error);
    }
  },
  action: "created",
  targetType: "survey",
});

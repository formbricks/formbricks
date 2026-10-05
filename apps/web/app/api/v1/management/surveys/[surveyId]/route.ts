import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyUpdateInput } from "@formbricks/types/surveys/types";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { deleteSurvey } from "@/app/api/v1/management/surveys/[surveyId]/lib/surveys";
import { checkSurveyWritePermissions, refuseV1CustomCss } from "@/app/api/v1/management/surveys/lib/utils";
import {
  addLegacyProjectOverwrites,
  normaliseProjectOverwritesToWorkspace,
} from "@/app/lib/api/api-backwards-compat";
import {
  addLegacyEnvironmentId,
  addLegacyEnvironmentIdBestEffort,
} from "@/app/lib/api/legacy-environment-id";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import {
  transformQuestionsToBlocks,
  validateSurveyInput,
  withDerivedQuestions,
  withoutInternalSurveyProjections,
} from "@/app/lib/api/survey-transformation";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { SURVEY_ACTION_FOR_METHOD, canApiKeyReachSurveyResource } from "@/lib/survey/visibility/api-key";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";

type TSurveyUpdateBody = Record<string, unknown> & {
  blocks?: Parameters<typeof validateSurveyInput>[0]["blocks"];
  endings?: Parameters<typeof transformQuestionsToBlocks>[1];
  questions?: Parameters<typeof transformQuestionsToBlocks>[0];
};

const fetchAndAuthorizeSurvey = async (
  surveyId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", surveyId) };
  }
  if (
    !(await can(
      { type: "apiKey", id: authentication.apiKeyId },
      getWorkspaceAuthorizationActionForMethod(requiredPermission),
      { type: "workspace", id: survey.workspaceId }
    )) ||
    // ENG-3282: an API key never reaches a restricted survey — the same answer as a foreign one.
    !(await canApiKeyReachSurveyResource(
      authentication.apiKeyId,
      SURVEY_ACTION_FOR_METHOD[requiredPermission],
      {
        type: "survey",
        id: survey.id,
      }
    ))
  ) {
    return { error: responses.unauthorizedResponse() };
  }

  return { survey };
};

/** The request body, or the 413/400 to answer with when it is too large or not JSON. */
const parseSurveyUpdateBody = async (
  req: Parameters<typeof parseJsonBodyWithLimit>[0]
): Promise<{ body: TSurveyUpdateBody } | { response: Response }> => {
  try {
    return { body: await parseJsonBodyWithLimit<TSurveyUpdateBody>(req) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }) };
    }

    logger.error({ error, url: req.url }, "Error parsing JSON input");
    return { response: responses.badRequestResponse("Malformed JSON input, please check your request body") };
  }
};

export const GET = withV1ApiWrapper({
  handler: async ({ props, authentication }: THandlerParams<{ params: Promise<{ surveyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;

    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "GET");
      if (result.error) {
        return {
          response: result.error,
        };
      }

      // Always expose `questions` (derived from blocks) alongside `blocks` so API v1
      // consumers get a consistent shape regardless of how the survey was built.
      return {
        response: responses.successResponse(
          await addLegacyEnvironmentId(
            addLegacyProjectOverwrites(
              resolveStorageUrlsInObject(
                withoutInternalSurveyProjections(withDerivedQuestions(result.survey))
              )
            )
          )
        ),
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse("Survey", params.surveyId),
        };
      }

      return handleErrorResponse(error);
    }
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ surveyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.surveyId;
    }

    let deletedSurvey: Awaited<ReturnType<typeof deleteSurvey>>;
    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "DELETE");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.survey;
      }

      deletedSurvey = await deleteSurvey(params.surveyId);
    } catch (error) {
      return handleErrorResponse(error);
    }

    // Enrich outside the delete's try/catch: the survey is already gone, so a lookup failure here
    // must not mask a successful delete behind a generic error response.
    return {
      response: responses.successResponse(await addLegacyEnvironmentIdBestEffort(deletedSurvey)),
    };
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
  }: THandlerParams<{ params: Promise<{ surveyId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.surveyId;
    }
    try {
      const result = await fetchAndAuthorizeSurvey(params.surveyId, authentication, "PUT");
      if (result.error) {
        return {
          response: result.error,
        };
      }
      if (auditLog) {
        auditLog.oldObject = result.survey;
      }

      const organization = await getOrganizationByWorkspaceId(result.survey.workspaceId);
      if (!organization) {
        return {
          response: responses.notFoundResponse("Organization", null),
        };
      }

      const parsedBody = await parseSurveyUpdateBody(req);
      if ("response" in parsedBody) {
        return { response: parsedBody.response };
      }
      let surveyUpdate = parsedBody.body;

      const customCssRefusal = refuseV1CustomCss(surveyUpdate);
      if (customCssRefusal) {
        return { response: customCssRefusal };
      }

      // Backwards compat: accept projectOverwrites as alias for workspaceOverwrites
      surveyUpdate = normaliseProjectOverwritesToWorkspace(surveyUpdate);

      const validateResult = validateSurveyInput({ ...surveyUpdate, updateOnly: true });
      if (!validateResult.ok) {
        return {
          response: responses.badRequestResponse(validateResult.error.message),
        };
      }

      const { hasQuestions } = validateResult.data;

      if (hasQuestions) {
        surveyUpdate.blocks = transformQuestionsToBlocks(
          surveyUpdate.questions ?? [],
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

      const featureCheckResult = await checkSurveyWritePermissions(
        surveyUpdate as Parameters<typeof checkSurveyWritePermissions>[0],
        organization,
        { apiKeyId: authentication.apiKeyId, workspaceId: result.survey.workspaceId },
        result.survey
      );
      if (featureCheckResult) {
        return {
          response: featureCheckResult,
        };
      }

      try {
        const updatedSurvey = await updateSurvey({ ...inputValidation.data, id: params.surveyId });
        if (auditLog) {
          auditLog.newObject = updatedSurvey;
        }

        return {
          // Best-effort, not strict: the update has committed by now, so a failed workspace lookup
          // would report a failure for an update that succeeded — and mark the audit entry failed
          // with it.
          response: responses.successResponse(
            await addLegacyEnvironmentIdBestEffort(
              addLegacyProjectOverwrites(
                resolveStorageUrlsInObject(
                  withoutInternalSurveyProjections(withDerivedQuestions(updatedSurvey))
                )
              )
            )
          ),
        };
      } catch (error) {
        return handleErrorResponse(error);
      }
    } catch (error) {
      return handleErrorResponse(error);
    }
  },
  action: "updated",
  targetType: "survey",
});

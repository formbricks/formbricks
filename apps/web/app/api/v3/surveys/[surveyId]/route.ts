import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successResponse,
} from "@/app/api/v3/lib/response";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyResource,
} from "@/app/api/v3/surveys/serializers";
import { getSurvey } from "@/lib/survey/service";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { normalizeV3SurveyLanguageTag } from "../language";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

const surveyQuerySchema = z
  .object({
    lang: z
      .string()
      .trim()
      .transform((value, ctx) => {
        const normalizedLanguage = normalizeV3SurveyLanguageTag(value);

        if (!normalizedLanguage) {
          ctx.addIssue({
            code: "custom",
            message: "Language must be a valid locale code",
          });
          return z.NEVER;
        }

        return normalizedLanguage;
      })
      .optional(),
    version: z.string().optional(),
  })
  .strict();

async function getAuthorizedSurvey(params: {
  surveyId: string;
  authentication: Parameters<typeof requireV3WorkspaceAccess>[0];
  access: "read" | "readWrite";
  requestId: string;
  instance: string;
}) {
  const { surveyId, authentication, access, requestId, instance } = params;
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return {
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
    };
  }

  const authResult = await requireV3WorkspaceAccess(
    authentication,
    survey.workspaceId,
    access,
    requestId,
    instance
  );

  if (authResult instanceof Response) {
    return { survey: null, authResult: null, response: authResult };
  }

  return { survey, authResult, response: null };
}

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: surveyParamsSchema,
    query: surveyQuerySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    const surveyId = parsedInput.params.surveyId;
    const log = logger.withContext({ requestId, surveyId });

    if (parsedInput.query.version !== undefined) {
      log.warn({ statusCode: 400 }, "V3 survey version selector is not supported");
      return problemBadRequest(requestId, "Survey version selectors are not supported yet", {
        instance,
        invalid_params: [
          {
            name: "version",
            reason: "Survey version selectors are not supported yet",
          },
        ],
      });
    }

    try {
      const { survey, response } = await getAuthorizedSurvey({
        surveyId,
        authentication,
        access: "read",
        requestId,
        instance,
      });

      if (response) {
        log.warn({ statusCode: response.status }, "Survey not found or not accessible");
        return response;
      }

      try {
        return successResponse(serializeV3SurveyResource(survey, { lang: parsedInput.query.lang }), {
          requestId,
          cache: "private, no-store",
        });
      } catch (error) {
        if (error instanceof V3SurveyLanguageError) {
          log.warn({ statusCode: 400, lang: parsedInput.query.lang }, "Invalid survey language selector");
          return problemBadRequest(requestId, error.message, {
            instance,
            invalid_params: [
              {
                name: "lang",
                reason: error.message,
              },
            ],
          });
        }

        if (error instanceof V3SurveyUnsupportedShapeError) {
          log.warn({ statusCode: 400 }, "Unsupported v3 survey shape");
          return problemBadRequest(requestId, error.message, {
            instance,
            invalid_params: [
              {
                name: "survey",
                reason: error.message,
              },
            ],
          });
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        log.error({ error, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, statusCode: 500 }, "V3 survey get unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const surveyId = parsedInput.params.surveyId;
    const log = logger.withContext({ requestId, surveyId });

    try {
      const { survey, authResult, response } = await getAuthorizedSurvey({
        surveyId,
        authentication,
        access: "readWrite",
        requestId,
        instance,
      });

      if (response) {
        log.warn({ statusCode: 403 }, "Survey not found or not accessible");
        return response;
      }

      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.organizationId = authResult.organizationId;
        auditLog.oldObject = survey;
      }

      await deleteSurvey(surveyId);

      return noContentResponse({ requestId });
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        log.warn({ errorCode: error.name, statusCode: 403 }, "Survey not found or not accessible");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      if (error instanceof DatabaseError) {
        log.error({ error, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, statusCode: 500 }, "V3 survey delete unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

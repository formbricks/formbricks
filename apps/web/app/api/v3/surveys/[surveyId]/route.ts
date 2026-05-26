import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteV3Survey, getV3Survey } from "../lib/operations";
import { parseV3SurveyLanguageQuery } from "../language";
import { patchV3Survey } from "../patch";
import { V3SurveyReferenceValidationError } from "../reference-validation";
import { ZV3EmptyQuery } from "../schemas";
import { V3SurveyWritePermissionError } from "../write-permissions";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

const surveyQuerySchema = z
  .object({
    lang: z
      .union([z.string(), z.array(z.string())])
      .transform((value, ctx) => {
        const parsedLanguageQuery = parseV3SurveyLanguageQuery(value);

        if (!parsedLanguageQuery.ok) {
          ctx.addIssue({
            code: "custom",
            message: parsedLanguageQuery.message,
          });
          return z.NEVER;
        }

        return parsedLanguageQuery.languages;
      })
      .optional(),
  })
  .strict();

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: surveyParamsSchema,
    query: surveyQuerySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await getV3Survey({
      surveyId: parsedInput.params.surveyId,
      lang: parsedInput.query.lang,
      authentication,
      requestId,
      instance,
    });
  },
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "survey",
  schemas: {
    params: surveyParamsSchema,
    query: ZV3EmptyQuery,
    body: z.unknown(),
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const surveyId = parsedInput.params.surveyId;
    const log = logger.withContext({ requestId, surveyId });
    let workspaceId: string | undefined;

    try {
      const { survey, authResult, response } = await getAuthorizedV3Survey({
        surveyId,
        authentication,
        access: "readWrite",
        requestId,
        instance,
      });

      if (response) {
        log.warn({ statusCode: response.status }, "Survey not found or not accessible");
        return response;
      }

      workspaceId = survey.workspaceId;
      const updatedSurvey = await patchV3Survey(
        survey,
        parsedInput.body,
        requestId,
        authResult.organizationId
      );
      const resource = serializeV3SurveyResource(updatedSurvey);

      if (auditLog) {
        auditLog.targetId = updatedSurvey.id;
        auditLog.organizationId = authResult.organizationId;
        auditLog.oldObject = serializeV3SurveyResource(survey);
        auditLog.newObject = resource;
      }

      return successResponse(resource, {
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      if (error instanceof V3SurveyReferenceValidationError) {
        log.warn(
          { statusCode: 400, workspaceId, invalidParamCount: error.invalidParams.length },
          "Survey document validation failed"
        );
        return problemBadRequest(requestId, "Invalid survey document", {
          invalid_params: error.invalidParams,
          instance,
        });
      }

      if (error instanceof V3SurveyUnsupportedShapeError) {
        log.warn({ statusCode: 400, workspaceId, errorCode: error.name }, "Unsupported v3 survey shape");
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

      if (error instanceof V3SurveyWritePermissionError) {
        log.warn(
          { statusCode: 403, workspaceId, errorCode: error.name },
          "Survey patch permission check failed"
        );
        return problemForbidden(requestId, error.message, instance);
      }

      if (error instanceof ResourceNotFoundError) {
        log.warn(
          { errorCode: error.name, workspaceId, statusCode: 403 },
          "Survey not found or not accessible"
        );
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      if (error instanceof DatabaseError) {
        log.error({ error, workspaceId, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, workspaceId, statusCode: 500 }, "V3 survey patch unexpected error");
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
    return await deleteV3Survey({
      surveyId: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});

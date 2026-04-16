import { logger } from "@formbricks/logger";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ValidationError,
} from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3SurveyAccess } from "@/app/api/v3/lib/auth";
import {
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successResponse,
} from "@/app/api/v3/lib/response";
import { updateSurvey } from "@/lib/survey/service";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { deleteSurvey } from "@/modules/survey/list/lib/survey";
import { applyV3SurveyPatch } from "../adapters";
import { ZV3SurveyPatchBody, ZV3SurveyRouteParams } from "../schemas";
import { serializeV3SurveyResource } from "../serializers";

function handleSurveyMutationError(
  error: unknown,
  requestId: string,
  instance: string,
  action: string
): Response {
  const log = logger.withContext({ requestId });

  if (error instanceof OperationNotAllowedError) {
    log.warn({ statusCode: 403, errorCode: error.name }, `Survey ${action} forbidden`);
    return problemForbidden(requestId, error.message, instance);
  }

  if (error instanceof InvalidInputError || error instanceof ValidationError) {
    log.warn({ statusCode: 400, errorCode: error.name }, `Survey ${action} validation failed`);
    return problemBadRequest(requestId, error.message, {
      instance,
    });
  }

  if (error instanceof DatabaseError) {
    log.error({ error, statusCode: 500 }, `Database error during survey ${action}`);
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }

  log.error({ error, statusCode: 500 }, `V3 survey ${action} unexpected error`);
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZV3SurveyRouteParams,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    const log = logger.withContext({ requestId, surveyId: parsedInput.params.surveyId });

    try {
      const authResult = await requireV3SurveyAccess(
        authentication,
        parsedInput.params.surveyId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      return successResponse(serializeV3SurveyResource(authResult.survey), {
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        log.error({ error, statusCode: 500 }, "Database error during survey fetch");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, statusCode: 500 }, "V3 survey fetch unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZV3SurveyRouteParams,
    body: ZV3SurveyPatchBody,
  },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) => {
    try {
      const authResult = await requireV3SurveyAccess(
        authentication,
        parsedInput.params.surveyId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const updatedSurveyInput = applyV3SurveyPatch(authResult.survey, parsedInput.body);
      await checkExternalUrlsPermission(authResult.organizationId, updatedSurveyInput, authResult.survey);

      const survey = await updateSurvey(updatedSurveyInput);
      const serializedSurvey = serializeV3SurveyResource(survey);

      if (auditLog) {
        auditLog.organizationId = authResult.organizationId;
        auditLog.targetId = survey.id;
        auditLog.oldObject = serializeV3SurveyResource(authResult.survey);
        auditLog.newObject = serializedSurvey;
      }

      return successResponse(serializedSurvey, {
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      return handleSurveyMutationError(error, requestId, instance, "update");
    }
  },
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: ZV3SurveyRouteParams,
  },
  action: "deleted",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) => {
    try {
      const authResult = await requireV3SurveyAccess(
        authentication,
        parsedInput.params.surveyId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      await deleteSurvey(parsedInput.params.surveyId);

      if (auditLog) {
        auditLog.organizationId = authResult.organizationId;
        auditLog.targetId = parsedInput.params.surveyId;
        auditLog.oldObject = serializeV3SurveyResource(authResult.survey);
      }

      return noContentResponse({
        requestId,
        cache: "private, no-store",
      });
    } catch (error) {
      return handleSurveyMutationError(error, requestId, instance, "delete");
    }
  },
});

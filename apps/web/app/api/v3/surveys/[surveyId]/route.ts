import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemInternalError, successResponse } from "@/app/api/v3/lib/response";
import { getSurvey } from "@/lib/survey/service";
import { deleteSurvey } from "@/modules/survey/lib/surveys";

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "survey",
  schemas: {
    params: z.object({
      surveyId: z.cuid2(),
    }),
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const surveyId = parsedInput.params.surveyId;
    const log = logger.withContext({ requestId, surveyId });

    try {
      const survey = await getSurvey(surveyId);

      if (!survey) {
        log.warn({ statusCode: 403 }, "Survey not found or not accessible");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }

      const authResult = await requireV3WorkspaceAccess(
        authentication,
        survey.environmentId,
        "readWrite",
        requestId,
        instance
      );

      if (authResult instanceof Response) {
        return authResult;
      }

      if (auditLog) {
        auditLog.targetId = survey.id;
        auditLog.organizationId = authResult.organizationId;
        auditLog.oldObject = survey;
      }

      const deletedSurvey = await deleteSurvey(surveyId);

      return successResponse(
        {
          id: deletedSurvey.id,
        },
        { requestId }
      );
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

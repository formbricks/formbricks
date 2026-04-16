/**
 * /api/v3/surveys — list and create surveys for a workspace.
 */
import { logger } from "@formbricks/logger";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successListResponse,
} from "@/app/api/v3/lib/response";
import { createSurvey } from "@/lib/survey/service";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { buildV3SurveyCreateInput, buildV3SurveyPreview } from "./adapters";
import { parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";
import { ZV3SurveyCreateBody } from "./schemas";
import { serializeV3SurveyListItem, serializeV3SurveyResource } from "./serializers";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    const log = logger.withContext({ requestId });

    try {
      const searchParams = new URL(req.url).searchParams;
      const parsed = parseV3SurveysListQuery(searchParams);
      if (!parsed.ok) {
        log.warn({ statusCode: 400, invalidParams: parsed.invalid_params }, "Validation failed");
        return problemBadRequest(requestId, "Invalid query parameters", {
          invalid_params: parsed.invalid_params,
          instance,
        });
      }

      const authResult = await requireV3WorkspaceAccess(
        authentication,
        parsed.workspaceId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const { environmentId } = authResult;

      const [{ surveys, nextCursor }, totalCount] = await Promise.all([
        getSurveyListPage(environmentId, {
          limit: parsed.limit,
          cursor: parsed.cursor,
          sortBy: parsed.sortBy,
          filterCriteria: parsed.filterCriteria,
        }),
        getSurveyCount(environmentId, parsed.filterCriteria),
      ]);

      return successListResponse(
        surveys.map(serializeV3SurveyListItem),
        {
          limit: parsed.limit,
          nextCursor,
          totalCount,
        },
        { requestId, cache: "private, no-store" }
      );
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }
      if (err instanceof DatabaseError) {
        log.error({ error: err, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }
      log.error({ error: err, statusCode: 500 }, "V3 surveys list unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: ZV3SurveyCreateBody,
  },
  action: "created",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) => {
    const log = logger.withContext({ requestId });

    try {
      const authResult = await requireV3WorkspaceAccess(
        authentication,
        parsedInput.body.workspaceId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const createdBy =
        authentication && "user" in authentication && authentication.user?.id ? authentication.user.id : null;
      const createInput = buildV3SurveyCreateInput(parsedInput.body, createdBy);
      const surveyPreview = buildV3SurveyPreview(authResult.environmentId, createInput);

      await checkExternalUrlsPermission(authResult.organizationId, surveyPreview, null);

      const survey = await createSurvey(authResult.environmentId, createInput);
      const serializedSurvey = serializeV3SurveyResource(survey);

      if (auditLog) {
        auditLog.organizationId = authResult.organizationId;
        auditLog.targetId = survey.id;
        auditLog.newObject = serializedSurvey;
      }

      return createdResponse(serializedSurvey, {
        requestId,
        cache: "private, no-store",
        location: `/api/v3/surveys/${survey.id}`,
      });
    } catch (error) {
      if (error instanceof OperationNotAllowedError) {
        log.warn({ statusCode: 403, errorCode: error.name }, "Survey creation forbidden");
        return problemForbidden(requestId, error.message, instance);
      }

      if (error instanceof InvalidInputError || error instanceof ValidationError) {
        log.warn({ statusCode: 400, errorCode: error.name }, "Survey creation validation failed");
        return problemBadRequest(requestId, error.message, {
          instance,
        });
      }

      if (error instanceof DatabaseError) {
        log.error({ error, statusCode: 500 }, "Database error during survey creation");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      if (error instanceof ResourceNotFoundError) {
        log.error({ error, statusCode: 500 }, "Missing resource during survey creation");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error, statusCode: 500 }, "V3 survey create unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

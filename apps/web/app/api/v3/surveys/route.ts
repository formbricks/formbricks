/**
 * /api/v3/surveys — list and create block-based survey management resources.
 * Session cookie or x-api-key; scope by workspaceId only.
 */
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successListResponse,
} from "@/app/api/v3/lib/response";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { V3SurveyCreatePermissionError, createV3Survey } from "./create";
import { parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";
import {
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyListItem,
  serializeV3SurveyResource,
} from "./serializers";

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

      const { workspaceId } = authResult;

      const surveyPagePromise = getSurveyListPage(workspaceId, {
        limit: parsed.limit,
        cursor: parsed.cursor,
        sortBy: parsed.sortBy,
        filterCriteria: parsed.filterCriteria,
      });
      const totalCountPromise = parsed.includeTotalCount
        ? getSurveyCount(workspaceId, parsed.filterCriteria)
        : Promise.resolve(null);
      const [surveyPage, totalCount] = await Promise.all([surveyPagePromise, totalCountPromise]);

      return successListResponse(
        surveyPage.surveys.map(serializeV3SurveyListItem),
        {
          limit: parsed.limit,
          nextCursor: surveyPage.nextCursor,
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
    body: ZV3CreateSurveyBody,
  },
  action: "created",
  targetType: "survey",
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) => {
    const { body } = parsedInput;
    const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

    try {
      const authResult = await requireV3WorkspaceAccess(
        authentication,
        body.workspaceId,
        "readWrite",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return authResult;
      }

      const survey = await createV3Survey(
        {
          ...body,
          workspaceId: authResult.workspaceId,
        },
        authentication,
        requestId,
        authResult.organizationId
      );
      const resource = serializeV3SurveyResource(survey);

      if (auditLog) {
        auditLog.organizationId = authResult.organizationId;
        auditLog.targetId = survey.id;
        auditLog.newObject = resource;
      }

      return createdResponse(resource, {
        requestId,
        location: `/api/v3/surveys/${survey.id}`,
      });
    } catch (err) {
      if (err instanceof V3SurveyReferenceValidationError) {
        log.warn({ statusCode: 400, invalidParams: err.invalidParams }, "Survey reference validation failed");
        return problemBadRequest(requestId, "Invalid survey references", {
          invalid_params: err.invalidParams,
          instance,
        });
      }
      if (err instanceof V3SurveyUnsupportedShapeError) {
        log.warn({ statusCode: 400, errorCode: err.name }, "Unsupported survey shape");
        return problemBadRequest(requestId, err.message, {
          invalid_params: [{ name: "body", reason: err.message }],
          instance,
        });
      }
      if (err instanceof V3SurveyCreatePermissionError) {
        log.warn({ statusCode: 403, errorCode: err.name }, "Survey create permission check failed");
        return problemForbidden(requestId, err.message, instance);
      }
      if (err instanceof ResourceNotFoundError) {
        log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
        return problemForbidden(requestId, "You are not authorized to access this resource", instance);
      }
      if (err instanceof DatabaseError) {
        log.error({ error: err, statusCode: 500 }, "Database error");
        return problemInternalError(requestId, "An unexpected error occurred.", instance);
      }

      log.error({ error: err, statusCode: 500 }, "V3 survey create unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  },
});

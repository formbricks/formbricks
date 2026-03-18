/**
 * GET /api/v3/surveys — list surveys for a workspace.
 * Session cookie or x-api-key; scope by workspaceId only.
 */
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  successListResponse,
} from "@/app/api/v3/lib/response";
import { getSurveyCount, getSurveys } from "@/modules/survey/list/lib/survey";
import type { TSurvey } from "@/modules/survey/list/types/surveys";
import { parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";

/** V3 list payload omits `singleUse`. */
function toV3SurveyListItem(survey: TSurvey): Omit<TSurvey, "singleUse"> {
  const { singleUse: _omit, ...rest } = survey;
  return rest;
}

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    const log = logger.withContext({ requestId });

    try {
      const sessionUserId =
        "user" in authentication && authentication.user?.id ? authentication.user.id : null;

      const searchParams = new URL(req.url).searchParams;
      const parsed = parseV3SurveysListQuery(searchParams, { sessionUserId });
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

      const [surveys, total] = await Promise.all([
        getSurveys(environmentId, parsed.limit, parsed.offset, parsed.filterCriteria),
        getSurveyCount(environmentId, parsed.filterCriteria),
      ]);

      return successListResponse(
        surveys.map(toV3SurveyListItem),
        {
          limit: parsed.limit,
          offset: parsed.offset,
          total,
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

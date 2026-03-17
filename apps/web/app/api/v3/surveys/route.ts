/**
 * GET /api/v3/surveys — list surveys for a workspace.
 * Session cookie or x-api-key; scope by workspaceId only.
 */
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemUnauthorized,
  successListResponse,
} from "@/app/api/v3/lib/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getSurveyCount, getSurveys } from "@/modules/survey/list/lib/survey";
import { parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";

export const GET = withV1ApiWrapper({
  unauthenticatedResponse: (req) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    return problemUnauthorized(requestId, "Not authenticated", req.nextUrl.pathname);
  },
  handler: async ({ req, authentication }) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.withContext({ requestId });
    const instance = new URL(req.url).pathname;

    try {
      if (!authentication) {
        return { response: problemUnauthorized(requestId, "Not authenticated", instance) };
      }

      const sessionUserId =
        "user" in authentication && authentication.user?.id ? authentication.user.id : null;

      const searchParams = new URL(req.url).searchParams;
      const parsed = parseV3SurveysListQuery(searchParams, { sessionUserId });
      if (!parsed.ok) {
        log.warn({ statusCode: 400, invalidParams: parsed.invalid_params }, "Validation failed");
        return {
          response: problemBadRequest(requestId, "Invalid query parameters", {
            invalid_params: parsed.invalid_params,
            instance,
          }),
        };
      }

      const authResult = await requireV3WorkspaceAccess(
        authentication,
        parsed.workspaceId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return { response: authResult };
      }

      const { environmentId } = authResult;

      const [surveys, total] = await Promise.all([
        getSurveys(environmentId, parsed.limit, parsed.offset, parsed.filterCriteria),
        getSurveyCount(environmentId, parsed.filterCriteria),
      ]);

      return {
        response: successListResponse(
          surveys,
          {
            limit: parsed.limit,
            offset: parsed.offset,
            total,
          },
          { requestId, cache: "private, no-store" }
        ),
      };
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
        return {
          response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
        };
      }
      if (err instanceof DatabaseError) {
        log.error({ error: err, statusCode: 500 }, "Database error");
        return { response: problemInternalError(requestId, "An unexpected error occurred.", instance) };
      }
      log.error({ error: err, statusCode: 500 }, "V3 surveys list unexpected error");
      return { response: problemInternalError(requestId, "An unexpected error occurred.", instance) };
    }
  },
});

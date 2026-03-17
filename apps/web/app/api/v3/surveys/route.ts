/**
 * GET /api/v3/surveys — list surveys for a workspace.
 * Session auth; scope by workspaceId only (no environmentId in the API).
 */
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problem400,
  problem401,
  problem403,
  problem500,
  successListResponse,
} from "@/app/api/v3/lib/response";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getSurveyCount, getSurveys } from "@/modules/survey/list/lib/survey";
import { parseV3SurveysListQuery } from "./parse-v3-surveys-list-query";

export const GET = withV1ApiWrapper({
  unauthenticatedResponse: (req) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    return problem401(requestId, "Not authenticated", req.nextUrl.pathname);
  },
  handler: async ({ req, authentication }) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.withContext({ requestId });
    const instance = new URL(req.url).pathname;

    try {
      if (!authentication || !("user" in authentication) || !authentication.user?.id) {
        return { response: problem401(requestId, "Not authenticated", instance) };
      }
      const sessionUserId = authentication.user.id;

      const searchParams = new URL(req.url).searchParams;
      const parsed = parseV3SurveysListQuery(searchParams, sessionUserId);
      if (!parsed.ok) {
        log.warn({ statusCode: 400, invalidParams: parsed.invalid_params }, "Validation failed");
        return {
          response: problem400(requestId, "Invalid query parameters", {
            invalid_params: parsed.invalid_params,
            instance,
          }),
        };
      }

      const authResult = await requireSessionWorkspaceAccess(
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
          response: problem403(requestId, "You are not authorized to access this resource", instance),
        };
      }
      if (err instanceof DatabaseError) {
        log.error({ error: err, statusCode: 500 }, "Database error");
        return { response: problem500(requestId, "An unexpected error occurred.", instance) };
      }
      log.error({ error: err, statusCode: 500 }, "V3 surveys list unexpected error");
      return { response: problem500(requestId, "An unexpected error occurred.", instance) };
    }
  },
});

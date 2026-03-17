/**
 * GET /api/v3/surveys — list surveys for a workspace.
 * Session auth; scope by workspaceId only (no environmentId in the API).
 */
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { type TSurveyFilterCriteria, ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
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

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Query schema: workspaceId required; limit/offset/filterCriteria optional. */
const ZQuery = z.object({
  workspaceId: ZId,
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  filterCriteria: z.string().optional(),
});

/** Parse optional JSON filterCriteria from query; invalid JSON is treated as missing. */
function parseFilterCriteria(value: string | undefined): TSurveyFilterCriteria | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = ZSurveyFilterCriteria.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function applySessionToCreatedByFilter(
  criteria: TSurveyFilterCriteria | undefined,
  sessionUserId: string
): TSurveyFilterCriteria | undefined {
  if (!criteria?.createdBy) return criteria;
  return {
    ...criteria,
    createdBy: {
      ...criteria.createdBy,
      userId: sessionUserId,
    },
  };
}

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
      const workspaceId = searchParams.get("workspaceId");
      const limitParam = searchParams.get("limit");
      const offsetParam = searchParams.get("offset");
      const filterCriteriaParam = searchParams.get("filterCriteria");

      const queryResult = ZQuery.safeParse({
        workspaceId,
        limit: limitParam ?? undefined,
        offset: offsetParam ?? undefined,
        filterCriteria: filterCriteriaParam ?? undefined,
      });

      if (!queryResult.success) {
        const invalidParams = queryResult.error.issues.map((issue) => ({
          name: issue.path.join(".") || "query",
          reason: issue.message,
        }));
        log.warn({ statusCode: 400, invalidParams }, "Validation failed");
        return {
          response: problem400(requestId, "Invalid query parameters", {
            invalid_params: invalidParams,
            instance,
          }),
        };
      }

      const parsedFilterCriteria = parseFilterCriteria(queryResult.data.filterCriteria);
      if (
        filterCriteriaParam !== null &&
        filterCriteriaParam !== undefined &&
        filterCriteriaParam !== "" &&
        parsedFilterCriteria === undefined
      ) {
        log.warn({ statusCode: 400 }, "Invalid filterCriteria JSON");
        return {
          response: problem400(requestId, "Invalid filterCriteria", {
            invalid_params: [
              { name: "filterCriteria", reason: "Must be valid JSON matching filter criteria schema" },
            ],
            instance,
          }),
        };
      }

      const filterCriteria = applySessionToCreatedByFilter(parsedFilterCriteria, sessionUserId);

      const authResult = await requireSessionWorkspaceAccess(
        authentication,
        queryResult.data.workspaceId,
        "read",
        requestId,
        instance
      );
      if (authResult instanceof Response) {
        return { response: authResult };
      }

      const { environmentId } = authResult;

      const [surveys, total] = await Promise.all([
        getSurveys(environmentId, queryResult.data.limit, queryResult.data.offset, filterCriteria),
        getSurveyCount(environmentId, filterCriteria),
      ]);

      return {
        response: successListResponse(
          surveys,
          {
            limit: queryResult.data.limit,
            offset: queryResult.data.offset,
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

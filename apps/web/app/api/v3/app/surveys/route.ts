/**
 * GET /api/v3/app/surveys — list surveys for a workspace.
 * Session auth; scope by workspaceId only (no environmentId in the API).
 */
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurveyFilterCriteria } from "@formbricks/types/surveys/types";
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
  workspaceId: z.string().cuid2(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  filterCriteria: z.string().optional(),
});

/** Parse optional JSON filterCriteria from query; invalid JSON is treated as missing. */
function parseFilterCriteria(value: string | undefined): z.infer<typeof ZSurveyFilterCriteria> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = ZSurveyFilterCriteria.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export const GET = withV1ApiWrapper({
  handler: async ({ req, authentication }) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.withContext({ requestId });
    // Instance for problem responses; path only, we do not read query until after auth.
    const instance = new URL(req.url).pathname;

    // --- Auth first (security): never read or validate query params before confirming session.
    // Unauthenticated requests must get 401 without leaking anything about the request (e.g. missing workspaceId).
    if (!authentication || !("user" in authentication) || !authentication.user?.id) {
      return { response: problem401(requestId, "Not authenticated", instance) };
    }

    // --- Parse and validate query (only after auth) ---
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
      const res = problem400(requestId, "Invalid query parameters", {
        invalid_params: invalidParams,
        instance,
      });
      return { response: res };
    }

    const filterCriteria = parseFilterCriteria(queryResult.data.filterCriteria);
    // Client sent filterCriteria but it was invalid JSON or didn't match schema → 400
    if (
      filterCriteriaParam !== null &&
      filterCriteriaParam !== undefined &&
      filterCriteriaParam !== "" &&
      filterCriteria === undefined
    ) {
      log.warn({ statusCode: 400 }, "Invalid filterCriteria JSON");
      const res = problem400(requestId, "Invalid filterCriteria", {
        invalid_params: [
          { name: "filterCriteria", reason: "Must be valid JSON matching filter criteria schema" },
        ],
        instance,
      });
      return { response: res };
    }

    // --- Auth: session + workspace access; returns context (environmentId, projectId, organizationId) or error Response
    const authResult = await requireSessionWorkspaceAccess(
      authentication ?? null,
      queryResult.data.workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return { response: authResult };
    }

    const { environmentId } = authResult;

    // --- Load surveys and total count in parallel (same filter so total matches list)
    try {
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
      // Map known errors to problem responses; rethrow the rest.
      // Use 403 (not 404) for ResourceNotFoundError to avoid leaking resource type/id existence.
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
      log.error({ error: err, statusCode: 500 }, "Unexpected error");
      return { response: problem500(requestId, "An unexpected error occurred.", instance) };
    }
  },
});

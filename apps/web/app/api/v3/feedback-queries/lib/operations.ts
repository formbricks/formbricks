import "server-only";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { resolveWorkspaceFeedbackTenant } from "@/app/api/v3/feedbackRecords/lib/access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import {
  problemBadGateway,
  problemForbidden,
  problemTooManyRequests,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { serializeV3FeedbackFieldCatalog } from "./catalog";
import { FEEDBACK_QUERY_RATE_LIMIT } from "./rate-limit";
import { type TV3FeedbackQuery, V3_FEEDBACK_QUERY_DEFAULT_LIMIT } from "./schemas";

/**
 * Transport-independent operations for the feedback query surface, shared by the HTTP routes and the MCP
 * tools. Read-only: a query never writes, and the one thing it spends is Cube capacity, which is why it has
 * a rate-limit bucket of its own.
 *
 * Tenancy: the Feedback Dataset is resolved from the workspace by `resolveWorkspaceFeedbackTenant`, the same
 * choke point the feedback-records surface uses, and handed to Cube as the signed security context. No input
 * can carry a tenant; Cube's `queryRewrite` is what appends the filter.
 */

const CACHE = "private, no-store" as const;

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * The licence feature behind feedback queries. Analysis is still gated by the `dashboards` entitlement,
 * the one the Cube-backed charts always used; this is the single place to point at a renamed feature when
 * dashboards are removed.
 */
async function requireFeedbackQueryEntitlement(
  organizationId: string,
  { requestId, instance }: Pick<TBaseParams, "requestId" | "instance">
): Promise<Response | null> {
  if (await getIsDashboardsEnabled(organizationId)) return null;

  return problemForbidden(
    requestId,
    "Feedback analytics is not enabled for this organization. It requires an Enterprise plan or license — an organization owner can enable it from the organization's billing or license settings.",
    instance
  );
}

/** The id a rate limit and an audit event attribute the call to, and which kind of principal it is. */
function getActor(authentication: TV3Authentication): { id: string; type: "user" | "api" } | null {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) return null;
  return { id: actor.id, type: actor.type === "apiKey" ? "api" : "user" };
}

export async function queryV3Feedback({
  workspaceId,
  datasetId,
  query,
  authentication,
  requestId,
  instance,
}: TBaseParams & { workspaceId: string; datasetId?: string; query: TV3FeedbackQuery }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      datasetId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) return resolution.response;

    const refusal = await requireFeedbackQueryEntitlement(resolution.organizationId, { requestId, instance });
    if (refusal) return refusal;

    const actor = getActor(authentication);
    if (!actor) {
      // Unreachable behind the access check above, which refuses an unidentified caller; kept so a future
      // principal type fails closed rather than querying as nobody.
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    try {
      await applyRateLimit(FEEDBACK_QUERY_RATE_LIMIT, actor.id);
    } catch (error) {
      log.warn({ err: error, statusCode: 429 }, "Feedback query rate limit exceeded");
      return problemTooManyRequests(
        requestId,
        error instanceof Error ? error.message : "Rate limit exceeded",
        error instanceof TooManyRequestsError ? error.retryAfter : undefined,
        instance
      );
    }

    // A bounded limit always reaches Cube: an omitted one would otherwise fall back to Cube's own ceiling.
    const effectiveQuery = { ...query, limit: query.limit ?? V3_FEEDBACK_QUERY_DEFAULT_LIMIT };

    const rows = await executeTenantScopedQuery({
      query: effectiveQuery,
      feedbackDirectoryId: resolution.tenantId,
      workspaceId: resolution.workspaceId,
      organizationId: resolution.organizationId,
      userId: actor.id,
      actorType: actor.type,
      source: "feedbackQueries.execute",
      includeResponseBase: false,
    });

    return successResponse(
      {
        datasetId: resolution.tenantId,
        datasetName: resolution.datasetName,
        query: effectiveQuery,
        rows: Array.isArray(rows) ? rows : [],
      },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    if (err instanceof CubeQueryError) {
      log.error({ err }, "Feedback query failed in Cube");
      // Not the thrown message: it names deployment settings that mean nothing to an API caller.
      return problemBadGateway(
        requestId,
        "The analytics service could not run this query. Retry shortly, or simplify the query; if it keeps failing, an administrator should check the analytics service.",
        instance
      );
    }
    return mapV3ThrownError(err, { log, requestId, instance, operation: "feedbackQueries.query" });
  }
}

export async function getV3FeedbackFieldCatalog({
  workspaceId,
  authentication,
  requestId,
  instance,
}: TBaseParams & { workspaceId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    // The catalog is the same for every workspace, but it is only useful where a query can run, so it
    // answers behind the same access and licence gates and an unlicensed caller learns that here.
    const access = await requireUnifyFeedbackWorkspaceAccess(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const refusal = await requireFeedbackQueryEntitlement(access.organizationId, { requestId, instance });
    if (refusal) return refusal;

    return successResponse(serializeV3FeedbackFieldCatalog(), { requestId, cache: CACHE });
  } catch (err) {
    return mapV3ThrownError(err, { log, requestId, instance, operation: "feedbackQueries.fieldCatalog" });
  }
}

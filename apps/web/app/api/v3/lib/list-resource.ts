import "server-only";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { paginateByIdCursor } from "@/app/api/v3/lib/cursor-pagination";
import { problemBadRequest, problemInternalError, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";

/** Shared params for the workspace-scoped v3 reference-list endpoints (action classes, attribute keys). */
export type TV3WorkspaceListParams = {
  workspaceId: string;
  limit: number;
  cursor?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TListV3WorkspaceResourceConfig<TRow extends { id: string }, TOut> = TV3WorkspaceListParams & {
  /** Human-readable resource name; used only in error logs. */
  resourceName: string;
  /** Fetch the workspace's full list (request-deduped); it is paginated in memory below. */
  fetchAll: (workspaceId: string) => Promise<readonly TRow[]>;
  /** Map a fetched row to its public response shape. */
  serialize: (row: TRow) => TOut;
  /** Optional entitlement gate, run after auth: return a Response to short-circuit (e.g. 403), or null to allow. */
  assertEntitlement?: (workspaceId: string) => Promise<Response | null>;
};

/**
 * Shared handler for the workspace-scoped v3 reference-list endpoints. Resolves workspace access,
 * runs an optional entitlement gate, fetches the full list and paginates it in memory — these are
 * bounded reference collections the codebase already reads as a whole (request-deduped via React
 * cache), so they don't fork the canonical read with a DB-side `take`/`cursor` query (see
 * paginateByIdCursor). A malformed cursor maps to 400; any other failure to 500.
 */
export async function listV3WorkspaceResource<TRow extends { id: string }, TOut>(
  config: TListV3WorkspaceResourceConfig<TRow, TOut>
): Promise<Response> {
  const {
    workspaceId,
    limit,
    cursor,
    authentication,
    requestId,
    instance,
    resourceName,
    fetchAll,
    serialize,
  } = config;
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const authResult = await requireV3WorkspaceAccess(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    if (config.assertEntitlement) {
      const denied = await config.assertEntitlement(authResult.workspaceId);
      if (denied) {
        return denied;
      }
    }

    const rows = await fetchAll(authResult.workspaceId);
    const { page, nextCursor } = paginateByIdCursor(rows, { limit, cursor });

    return successListResponse(
      page.map(serialize),
      { limit, nextCursor },
      { requestId, cache: "private, no-store" }
    );
  } catch (err) {
    if (err instanceof InvalidInputError) {
      log.warn({ statusCode: 400 }, "Invalid pagination cursor");
      return problemBadRequest(requestId, err.message, {
        invalid_params: [{ name: "cursor", reason: err.message }],
        instance,
      });
    }
    log.error(
      { err },
      `${err instanceof DatabaseError ? "Database error" : "Unexpected error"} while listing ${resourceName}`
    );
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}

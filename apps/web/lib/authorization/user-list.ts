import "server-only";
import { performance } from "node:perf_hooks";
import { getAuthorizationSurface, recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationAction, TAuthorizationResourceForAction } from "./contract";
import { recordAuthorizationDecision } from "./metrics";
import { normalizeAuthorizationOperationalError } from "./operational-error";
import { filterSpicedbAuthorizedUserIds } from "./spicedb-evaluator";

/** Authorize a recipient list through the same policy as individual user checks. */
export const filterAuthorizedUserIds = async <TAction extends TAuthorizationAction>(
  userIds: ReadonlyArray<string>,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<ReadonlySet<string>> => {
  if (userIds.length === 0) return new Set();
  recordAuthorizationCheckIssued();
  const startedAt = performance.now();
  const metric = {
    action,
    actorType: "user",
    resourceType: resource.type,
    surface: getAuthorizationSurface(),
  } as const;
  try {
    const ids = await filterSpicedbAuthorizedUserIds(userIds, action, resource);
    recordAuthorizationDecision({
      ...metric,
      durationMs: performance.now() - startedAt,
      outcome: ids.size ? "allow" : "deny",
    });
    return ids;
  } catch (error) {
    const normalized = normalizeAuthorizationOperationalError(error, "authorization_list");
    recordAuthorizationDecision({
      ...metric,
      durationMs: performance.now() - startedAt,
      errorCode: normalized.code,
      outcome: "operational_error",
    });
    throw normalized;
  }
};

import "server-only";
import { performance } from "node:perf_hooks";
import { getAuthorizationSurface } from "./context";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { recordAuthorizationDecision } from "./metrics";
import { normalizeAuthorizationOperationalError } from "./operational-error";
import { spicedbEvaluator } from "./spicedb-evaluator";

/**
 * The one authoritative authorization coordinator.
 *
 * Rollout surfaces and request context are deliberately irrelevant here: every central decision,
 * including calls made outside a request boundary, is evaluated by SpiceDB. A missing source actor or
 * resource is a genuine denial from `spicedbEvaluator`; configuration, resolver, freshness, and
 * transport failures are typed operational failures and therefore fail closed.
 */
export const authorizationCoordinator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const startedAt = performance.now();
    const metric = {
      action,
      actorType: actor.type,
      resourceType: resource.type,
      surface: getAuthorizationSurface(),
    } as const;

    try {
      const allowed = await spicedbEvaluator.can(actor, action, resource);
      recordAuthorizationDecision({
        ...metric,
        durationMs: performance.now() - startedAt,
        outcome: allowed ? "allow" : "deny",
      });
      return allowed;
    } catch (error) {
      const normalized = normalizeAuthorizationOperationalError(error, "authorization");
      recordAuthorizationDecision({
        ...metric,
        durationMs: performance.now() - startedAt,
        errorCode: normalized.code,
        outcome: "operational_error",
      });
      throw normalized;
    }
  },
};

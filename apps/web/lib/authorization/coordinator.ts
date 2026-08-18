import "server-only";
import { normalizeAuthorizationOperationalError } from "./comparison-helpers";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
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
    try {
      return await spicedbEvaluator.can(actor, action, resource);
    } catch (error) {
      throw normalizeAuthorizationOperationalError(error, "authorization");
    }
  },
};

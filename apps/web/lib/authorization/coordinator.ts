import "server-only";
import { performance } from "node:perf_hooks";
import { bridgeEvaluator } from "./bridge-evaluator";
import { getAuthorizationSurface } from "./context";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { recordAuthorizationDecision } from "./metrics";
import { normalizeAuthorizationOperationalError } from "./operational-error";

/**
 * Temporary Cloud bridge's one authoritative authorization coordinator.
 *
 * Rollout surfaces and request context are deliberately irrelevant here: every central decision,
 * including calls made outside a request boundary, is evaluated against PostgreSQL. This static
 * wiring is confined to the disposable bridge branch, never normal v6. Missing actors/resources
 * are genuine denials; resolver failures remain sanitized operational errors that fail closed.
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
      const allowed = await bridgeEvaluator.can(actor, action, resource);
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

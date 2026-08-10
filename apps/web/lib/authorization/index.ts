import "server-only";
import { AuthorizationError } from "@formbricks/types/errors";
import { recordAuthorizationCheckIssued } from "./context";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";
import { authorizationCoordinator } from "./coordinator";
import type { AuthorizationEvaluator } from "./evaluator";

/**
 * The single, engine-independent authorization interface for Formbricks (Phase 0
 * of the Authorization & Access Refinement project).
 *
 * `can` returns a boolean decision; `assertCan` throws an `AuthorizationError`
 * on denial. Both evaluate today's authorization rules and change nothing about
 * who can access what — they only funnel scattered checks through one boundary.
 * The evaluator is selected here; a SpiceDB-backed evaluator can replace it
 * later without touching any caller.
 */

const evaluator: AuthorizationEvaluator = authorizationCoordinator;

/**
 * Whether `actor` may perform `action` on `resource`.
 *
 * Counted here, once, ahead of the evaluator call — the ENG-1739 per-request instrumentation. This
 * is the one place every `can()` and `assertCan()` call passes through regardless of caller, so it
 * is the only place a count taken here is guaranteed not to miss or double-count a decision.
 */
export const can = <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<boolean> => {
  recordAuthorizationCheckIssued();
  return evaluator.can(actor, action, resource);
};

/** Assert that `actor` may perform `action` on `resource`, throwing `AuthorizationError` otherwise. */
export const assertCan = async <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<void> => {
  const allowed = await can(actor, action, resource);
  if (!allowed) {
    throw new AuthorizationError("Not authorized");
  }
};

export type {
  TAuthorizationAction,
  TAuthorizationActor,
  TAuthorizationResource,
  TAuthorizationResourceForAction,
  TAuthorizationResourceType,
} from "./contract";

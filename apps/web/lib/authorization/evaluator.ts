import "server-only";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";

/**
 * A backend that answers a single authorization decision. Phase 0 ships one
 * implementation backed by the current Formbricks rules (`legacyEvaluator`); a
 * SpiceDB-backed implementation will be added behind the same interface later,
 * so product call sites never change when the backend does.
 *
 * The action is the sole generic inference source; `NoInfer` on the resource
 * prevents TypeScript from widening a mismatched action/resource pair (per the
 * contract in `./contract`).
 */
export interface AuthorizationEvaluator {
  can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean>;
}

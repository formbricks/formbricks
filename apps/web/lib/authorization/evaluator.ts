import "server-only";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceForAction } from "./contract";

/**
 * A backend that answers one authorization decision. The runtime implementation
 * is SpiceDB-backed while product call sites depend only on this interface.
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

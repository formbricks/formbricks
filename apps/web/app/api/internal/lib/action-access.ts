import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { type TAuthorizationAction, type TAuthorizationResourceForAction, can } from "@/lib/authorization";

/**
 * Authorize a request against one resource: a session user who may take `action` on it, as the server
 * actions the internal routes replace asked with `assertCan`. 401 without a session user; the uniform 403
 * otherwise. The resolver denies an unknown id too, so a missing resource and one the caller can't reach
 * answer the same 403, byte for byte, and ids can't be walked.
 */
export async function requireActionAccess<TAction extends TAuthorizationAction>({
  authentication,
  action,
  resource,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  action: TAction;
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>;
  requestId: string;
  instance?: string;
}): Promise<Response | { userId: string }> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  if (!(await can(actor, action, resource))) {
    return problemForbidden(requestId, undefined, instance);
  }

  return { userId: actor.id };
}

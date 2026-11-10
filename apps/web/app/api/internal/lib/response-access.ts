import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";

/** What an internal response route asks of the caller, in the app's authorization vocabulary. */
export type TResponseAction = "response.read" | "response.write";

/**
 * Authorize a request against one response: a session user who may take `action` on it, as the server
 * actions these routes replace asked with `assertCan`. The resolver denies an unknown id too, so a missing
 * response, one on a restricted survey and one in a workspace the caller can't reach all answer the same 403.
 */
export async function requireResponseActionAccess({
  authentication,
  responseId,
  action,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  responseId: string;
  action: TResponseAction;
  requestId: string;
  instance?: string;
}): Promise<Response | { userId: string }> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  if (!(await can(actor, action, { type: "response", id: responseId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  return { userId: actor.id };
}

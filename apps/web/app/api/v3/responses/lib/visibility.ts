import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { type TAuthorizationAction, type TAuthorizationResourceForAction, can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { type TSurveyActorContext, resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";

/**
 * Responses follow their survey (ENG-3282, contract §7). Once survey visibility is enforced, workspace
 * access is necessary but not sufficient: a response of a restricted survey is its owner's and the
 * organization administrators'. Checked after the workspace gate, with the same 403 body as an unknown
 * id, so a restricted survey's responses are not probeable. A no-op while the marker is off, so a
 * deployment that has not opted in pays no second check.
 */
export async function refuseUnlessV3SurveyVisible<TAction extends TAuthorizationAction>(
  authentication: TV3Authentication,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>,
  requestId: string,
  instance?: string
): Promise<Response | null> {
  if (!(await isSurveyVisibilityReady())) return null;

  const actor = getV3AuthorizationActor(authentication);
  if (actor && (await can(actor, action, resource))) return null;
  return problemForbidden(requestId, undefined, instance);
}

/** The caller, in the terms the list and count predicate needs. */
export async function resolveV3ResponsesActorContext(
  authentication: TV3Authentication,
  organizationId: string
): Promise<TSurveyActorContext> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) throw new Error("Responses visibility context resolved without an authenticated actor");
  return resolveSurveyActorContext(actor, organizationId);
}

import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { type TAuthorizationAction, type TAuthorizationResourceForAction, can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { buildVisibleSurveyWhere } from "./predicate";

/**
 * The visibility rules for the API-key-only management APIs (v1, v2), ENG-3282. An API key never sees
 * a private survey or one with a change pending (K-1), so its predicate needs no per-caller check.
 */

/** The `Survey` clause every list an API key reads must carry. `{}` while the marker is off. */
export const getApiKeyVisibleSurveyWhere = async (): Promise<Prisma.SurveyWhereInput> =>
  buildVisibleSurveyWhere({ enforced: await isSurveyVisibilityReady(), kind: "apiKey" });

/**
 * For a route that already passed its workspace check: whether the key may act on this survey or
 * response too. Always `true` while the marker is off, so those routes make exactly the checks they
 * made before ENG-3282.
 */
export const canApiKeyReachSurveyResource = async <TAction extends TAuthorizationAction>(
  apiKeyId: string,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<boolean> => {
  if (!(await isSurveyVisibilityReady())) return true;
  return can({ type: "apiKey", id: apiKeyId }, action, resource);
};

/** The survey and response permission each management HTTP method needs, matching its workspace ladder. */
export const SURVEY_ACTION_FOR_METHOD = {
  DELETE: "survey.manage",
  GET: "survey.read",
  POST: "survey.write",
  PUT: "survey.write",
} as const;

export const RESPONSE_ACTION_FOR_METHOD = {
  DELETE: "response.manage",
  GET: "response.read",
  POST: "response.write",
  PUT: "response.write",
} as const;

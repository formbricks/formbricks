import "server-only";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TAuthorizationActor } from "@/lib/authorization";
import { getSurveyVisibilityGates } from "./gates";

export type TSurveyCreationFacts = Readonly<{ ownerId: string | null; visibility: TSurveyVisibility }>;

/**
 * `POST /api/v3/surveys` asked for `restricted` while the organization lacks the entitlement or the
 * deployment's readiness marker is unset (contract §5). Answered 403 `visibility_not_enabled`; refusing
 * rather than falling back to `workspace` is deliberate — a silent downgrade would tell the caller it
 * had restricted the survey when it had not.
 */
export class SurveyCreationVisibilityNotEnabledError extends Error {
  constructor() {
    super("Survey visibility is not enabled for this organization");
    this.name = "SurveyCreationVisibilityNotEnabledError";
  }
}

/**
 * A create asked for `restricted` from a principal that can own nothing — an API key, or no principal
 * at all. A survey without an owner cannot be restricted (`owner` is a user relation), and there is no
 * stored survey to duplicate or repair afterwards, so the request is refused 422 before anything is
 * written. Changing a *stored* ownerless survey's visibility is refused by its own error, with a
 * detail about duplicating it; that wording would be nonsense here.
 */
export class SurveyCreationVisibilityNotAllowedError extends Error {
  constructor() {
    super("A survey created without an owner cannot be restricted");
    this.name = "SurveyCreationVisibilityNotAllowedError";
  }
}

/**
 * Visibility and owner for a survey about to be created, on every creation path (contract §4, R-11):
 * blank, template, generate-then-create, duplicate and copy alike.
 *
 * - signed-in user, marker and entitlement on → restricted, owned by them;
 * - signed-in user otherwise → workspace-visible, still owned by them (the owner is what a later
 *   restriction needs);
 * - API key → workspace-visible, no owner. A `createdBy` in a v1 body is attribution, never ownership.
 *
 * `requestedVisibility` is the caller's explicit choice, accepted by create alone. Omitted it resolves
 * exactly as it always has; `workspace` needs no gates read; `restricted` is honoured only where the
 * gates are on and the principal can own the survey, and is refused otherwise — never downgraded.
 */
export const resolveSurveyCreationFacts = async ({
  actor,
  organizationId,
  requestedVisibility,
}: Readonly<{
  actor: TAuthorizationActor | null;
  organizationId: string | null;
  requestedVisibility?: TSurveyVisibility;
}>): Promise<TSurveyCreationFacts> => {
  // No principal to own it — the conservative default, identical to an API key's.
  if (actor?.type !== "user") {
    if (requestedVisibility === "restricted") throw new SurveyCreationVisibilityNotAllowedError();
    return { ownerId: null, visibility: "workspace" };
  }
  if (!organizationId) throw new Error("A signed-in creation needs the target organization");

  if (requestedVisibility === "workspace") return { ownerId: actor.id, visibility: "workspace" };

  const { entitled, ready } = await getSurveyVisibilityGates(organizationId);
  if (requestedVisibility === "restricted" && !(ready && entitled)) {
    throw new SurveyCreationVisibilityNotEnabledError();
  }

  return { ownerId: actor.id, visibility: ready && entitled ? "restricted" : "workspace" };
};

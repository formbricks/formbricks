import "server-only";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TAuthorizationActor } from "@/lib/authorization";
import { getSurveyVisibilityGates } from "./gates";

export type TSurveyCreationFacts = Readonly<{ ownerId: string | null; visibility: TSurveyVisibility }>;

/**
 * Visibility and owner for a survey about to be created, on every creation path (contract §4, R-11):
 * blank, template, generate-then-create, duplicate and copy alike.
 *
 * - signed-in user, marker and entitlement on → restricted, owned by them;
 * - signed-in user otherwise → workspace-visible, still owned by them (the owner is what a later
 *   restriction needs);
 * - API key → workspace-visible, no owner. A `createdBy` in a v1 body is attribution, never ownership.
 */
export const resolveSurveyCreationFacts = async ({
  actor,
  organizationId,
}: Readonly<{
  actor: TAuthorizationActor | null;
  organizationId: string | null;
}>): Promise<TSurveyCreationFacts> => {
  // No principal to own it — the conservative default, identical to an API key's.
  if (actor?.type !== "user") return { ownerId: null, visibility: "workspace" };
  if (!organizationId) throw new Error("A signed-in creation needs the target organization");

  const { entitled, ready } = await getSurveyVisibilityGates(organizationId);
  return { ownerId: actor.id, visibility: ready && entitled ? "restricted" : "workspace" };
};

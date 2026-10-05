import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getSurveyVisibilityGates } from "@/lib/survey/visibility/gates";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import type { TV3SurveyResourceVisibility, TV3SurveyVisibilityContext } from "./serializers";

/**
 * Resolve, once per request, who is asking and which visibility switches are on (ENG-3282). Shared by
 * the list, the single-survey reads and writes, and the visibility endpoint, so they all describe a
 * survey the same way. Only ever called after the workspace check, so an actor is always present.
 */
export async function resolveV3SurveyVisibilityContext(
  authentication: TV3Authentication,
  organizationId: string
): Promise<TV3SurveyVisibilityContext> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) throw new Error("Survey visibility context resolved without an authenticated actor");

  const [actorContext, gates] = await Promise.all([
    resolveSurveyActorContext(actor, organizationId),
    getSurveyVisibilityGates(organizationId),
  ]);
  return { actorContext, gates };
}

/** The same, plus the owner's display name for a single-survey representation. */
export async function resolveV3SurveyResourceVisibility(
  survey: Readonly<{ ownerId: string | null }>,
  authentication: TV3Authentication,
  organizationId: string
): Promise<TV3SurveyResourceVisibility> {
  const [context, owner] = await Promise.all([
    resolveV3SurveyVisibilityContext(authentication, organizationId),
    survey.ownerId
      ? prisma.user.findUnique({ where: { id: survey.ownerId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  return { ...context, ownerName: owner?.name ?? null };
}

/** Matches no survey: what a survey reference is checked against when the caller cannot be resolved. */
export const NO_VISIBLE_SURVEYS: Prisma.SurveyWhereInput = { id: { in: [] } };

/**
 * The `Survey` clause for the surveys this caller may reference (ENG-3282), e.g. in a survey-interaction
 * targeting filter. Fails closed: without an actor or an organization nothing is referenceable.
 */
export async function resolveV3VisibleSurveyWhere(
  authentication: TV3Authentication,
  organizationId: string | null | undefined
): Promise<Prisma.SurveyWhereInput> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor || !organizationId) return NO_VISIBLE_SURVEYS;
  return buildVisibleSurveyWhere(await resolveSurveyActorContext(actor, organizationId));
}

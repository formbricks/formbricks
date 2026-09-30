import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { type TSurveyAccess, deriveSurveyAccess } from "@/lib/survey/visibility/access";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { type TSurveyVisibilityGates, getSurveyVisibilityGates } from "@/lib/survey/visibility/gates";
import { getEffectiveVisibility, getPendingVisibility } from "@/lib/survey/visibility/policy";
import type { TSurveyVisibilityUiGate } from "./state";

type TSurveyVisibilityRow = Parameters<typeof deriveSurveyAccess>[0];

/**
 * The switches the restricted-surveys UI reads (ENG-3395), from the contract's two gates: display and
 * enforcement follow readiness alone — losing the entitlement never releases a restricted survey — and
 * changing visibility needs the entitlement too. See `TSurveyVisibilityUiGate`.
 */
const toSurveyVisibilityUiGate = (gates: TSurveyVisibilityGates): TSurveyVisibilityUiGate => ({
  enforced: gates.ready,
  manageable: gates.ready && gates.entitled,
});

export const getSurveyVisibilityUiGate = async (organizationId: string): Promise<TSurveyVisibilityUiGate> =>
  toSurveyVisibilityUiGate(await getSurveyVisibilityGates(organizationId));

/**
 * For the outbound pickers (integrations, webhooks, feedback sources, workflows), which only describe
 * enforcement: they refuse a restricted survey for as long as the server does, which is as long as the
 * readiness marker is set — whether or not the organization can still change visibility.
 */
export const isSurveyVisibilityEnforced = (): Promise<boolean> => isSurveyVisibilityReady();

export type TSurveyVisibilityViewer = Readonly<{
  surveyVisibilityGate: TSurveyVisibilityUiGate;
  /**
   * What is enforced right now (`getEffectiveVisibility`), not the stored flag: a change still in flight
   * counts as restricted, whichever way it points. `"workspace"` while visibility is not enforced.
   */
  visibility: TSurveyVisibility;
  /** The value a stored change is still settling to, or `null` when nothing is in flight. */
  pendingVisibility: TSurveyVisibility | null;
  /** Why this user can see the survey, as the v3 representations report it. `null` while not enforced. */
  surveyAccess: TSurveyAccess | null;
  /** The author's display name; `null` when the survey has no owner or visibility is not enforced. */
  ownerName: string | null;
}>;

const NOT_ENFORCED: TSurveyVisibilityViewer = {
  surveyVisibilityGate: { enforced: false, manageable: false },
  visibility: "workspace",
  pendingVisibility: null,
  surveyAccess: null,
  ownerName: null,
};

/**
 * What a single-survey page (editor, summary, responses) needs to render the visibility UI for this
 * user. The editor's survey is the Prisma shape, not the v3 one, so the effective visibility, `access`
 * and the owner name are derived here rather than read off the object. While visibility is not
 * enforced it answers without further queries.
 */
export const getSurveyVisibilityViewer = async (
  survey: TSurveyVisibilityRow,
  userId: string,
  organizationId: string
): Promise<TSurveyVisibilityViewer> => {
  const gates = await getSurveyVisibilityGates(organizationId);
  const surveyVisibilityGate = toSurveyVisibilityUiGate(gates);
  if (!surveyVisibilityGate.enforced) return NOT_ENFORCED;

  const [actorContext, owner] = await Promise.all([
    resolveSurveyActorContext({ id: userId, type: "user" }, organizationId),
    survey.ownerId
      ? prisma.user.findUnique({ where: { id: survey.ownerId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  return {
    surveyVisibilityGate,
    visibility: getEffectiveVisibility(survey),
    pendingVisibility: getPendingVisibility(survey),
    surveyAccess: deriveSurveyAccess(survey, actorContext, gates),
    ownerName: owner?.name ?? null,
  };
};

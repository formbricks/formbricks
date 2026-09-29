import "server-only";
import { prisma } from "@formbricks/database";
import { type TSurveyAccess, deriveSurveyAccess } from "@/lib/survey/visibility/access";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { type TSurveyVisibilityGates, getSurveyVisibilityGates } from "@/lib/survey/visibility/gates";

type TSurveyVisibilityRow = Parameters<typeof deriveSurveyAccess>[0];

/**
 * The one switch the restricted-surveys UI reads (ENG-3395): the deployment's readiness marker and the
 * organization's entitlement together. Computed on the server and passed down as a prop — the client
 * never decides entitlement on its own. While it is off the product looks exactly as it did before.
 */
const isSurveyVisibilityUiEnabled = (gates: TSurveyVisibilityGates): boolean => gates.ready && gates.entitled;

export const getSurveyVisibilityUiGate = async (organizationId: string): Promise<boolean> =>
  isSurveyVisibilityUiEnabled(await getSurveyVisibilityGates(organizationId));

export type TSurveyVisibilityViewer = Readonly<{
  surveyVisibilityEnabled: boolean;
  /** Why this user can see the survey, as the v3 representations report it. `null` while the gate is off. */
  surveyAccess: TSurveyAccess | null;
  /** The author's display name; `null` when the survey has no owner or the gate is off. */
  ownerName: string | null;
}>;

const GATE_OFF: TSurveyVisibilityViewer = {
  surveyVisibilityEnabled: false,
  surveyAccess: null,
  ownerName: null,
};

/**
 * What a single-survey page (editor, summary, responses) needs to render the visibility UI for this
 * user. The editor's survey is the Prisma shape, not the v3 one, so `access` and the owner name are
 * derived here rather than read off the object. With the gate off it answers without further queries.
 */
export const getSurveyVisibilityViewer = async (
  survey: TSurveyVisibilityRow,
  userId: string,
  organizationId: string
): Promise<TSurveyVisibilityViewer> => {
  const gates = await getSurveyVisibilityGates(organizationId);
  if (!isSurveyVisibilityUiEnabled(gates)) return GATE_OFF;

  const [actorContext, owner] = await Promise.all([
    resolveSurveyActorContext({ id: userId, type: "user" }, organizationId),
    survey.ownerId
      ? prisma.user.findUnique({ where: { id: survey.ownerId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  return {
    surveyVisibilityEnabled: true,
    surveyAccess: deriveSurveyAccess(survey, actorContext, gates),
    ownerName: owner?.name ?? null,
  };
};

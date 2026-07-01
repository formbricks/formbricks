import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import { ZWorkflowDefinition } from "@formbricks/workflows";
import { createWorkflowsService } from "@formbricks/workflows/server";
import { DEFAULT_LOCALE, MAIL_FROM } from "@/lib/constants";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTeamMemberDetails } from "@/modules/survey/editor/lib/team";
import { getUserEmail, getUserLocale } from "@/modules/survey/editor/lib/user";
import type { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import { getSurvey } from "@/modules/survey/lib/survey";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import type { TWorkflowEmailAuthoringContext } from "@/modules/workflows/types/email-authoring-context";

const workflowsService = createWorkflowsService({ prisma });

/** Reads the bound survey id from a workflow row's (untrusted JSON) definition trigger, if any. */
const readTriggerSurveyId = (definition: unknown): string | null => {
  const parsed = ZWorkflowDefinition.safeParse(definition);
  return parsed.success ? parsed.data.trigger.config.surveyId : null;
};

/**
 * Server-side loader for the data the workflow `send_email` inspector needs to author an email with
 * Follow-Ups parity: the bound survey (full internal `TSurvey` for recall + recipient options), the
 * team roster, the current user's email/locale, and the configured sender. Resolved entirely in the
 * route so the client form receives fully-formed objects (no client re-lookup by id).
 *
 * The bound survey is looked up from the workflow's persisted trigger `surveyId`; it may be `null`
 * when the workflow has no survey bound yet or the survey was deleted — the form degrades gracefully.
 */
export const getWorkflowEmailAuthoringContext = async ({
  workflowId,
  workspaceId,
}: {
  workflowId: string;
  workspaceId: string;
}): Promise<TWorkflowEmailAuthoringContext> => {
  const session = await getServerSession(authOptions);
  // Match the app-wide default sender used by `@/modules/email` so the read-only From box shows the
  // address emails are actually sent from.
  const mailFrom = MAIL_FROM ?? "noreply@formbricks.com";

  const emptyContext: TWorkflowEmailAuthoringContext = {
    survey: null,
    teamMemberDetails: [],
    userEmail: "",
    mailFrom,
    locale: DEFAULT_LOCALE,
  };

  if (!session?.user) {
    return emptyContext;
  }

  const [workflow, workspaceWithTeamIds, userEmail, locale] = await Promise.all([
    workflowsService.getWorkflowById(workflowId),
    getWorkspaceWithTeamIds(workspaceId),
    getUserEmail(session.user.id),
    getUserLocale(session.user.id),
  ]);

  // Only serve context for a workflow that belongs to the URL workspace (defense in depth; the page
  // auth already gates workspace access).
  if (!workflow || workflow.workspaceId !== workspaceId) {
    return { ...emptyContext, userEmail: userEmail ?? "", locale: locale ?? DEFAULT_LOCALE };
  }

  const teamMemberDetails: TFollowUpEmailToUser[] = workspaceWithTeamIds
    ? await getTeamMemberDetails(workspaceWithTeamIds.teamIds)
    : [];

  // The trigger `surveyId` is author-set but NOT workspace-validated by the workflow patch handler, so a
  // member could point it at another workspace's survey. Scope by `workspaceId` here (IDOR guard); a
  // non-matching or missing survey resolves to null and the form degrades to plain inputs.
  const surveyId = readTriggerSurveyId(workflow.definition);
  const loadedSurvey = surveyId ? await getSurvey(surveyId).catch(() => null) : null;
  const survey = loadedSurvey && loadedSurvey.workspaceId === workspaceId ? loadedSurvey : null;

  return {
    survey,
    teamMemberDetails,
    userEmail: userEmail ?? "",
    mailFrom,
    locale: locale ?? DEFAULT_LOCALE,
  };
};

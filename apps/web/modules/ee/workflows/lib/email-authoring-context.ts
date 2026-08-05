import "server-only";
import { prisma } from "@formbricks/database";
import { ZWorkflowDefinition } from "@formbricks/workflows";
import { createWorkflowsService } from "@formbricks/workflows/server";
import { DEFAULT_LOCALE, MAIL_FROM } from "@/lib/constants";
import { getWorkspaceMembers } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import type { TWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/types/email-authoring-context";
import { getUserEmail, getUserLocale } from "@/modules/survey/editor/lib/user";
import { getSurvey } from "@/modules/survey/lib/survey";

const workflowsService = createWorkflowsService({ prisma });

/** Reads the bound survey id from a workflow row's (untrusted JSON) definition trigger, if any. */
const readTriggerSurveyId = (definition: unknown): string | null => {
  const parsed = ZWorkflowDefinition.safeParse(definition);
  if (!parsed.success) return null;
  return parsed.data.trigger?.config.surveyId ?? null;
};

/**
 * Server-side loader for the data the workflow `send_email` inspector needs to author an email with
 * Follow-Ups parity: the bound survey (full internal `TSurvey` for recall + recipient options), the
 * members who can access the workspace, the current user's email/locale, and the configured sender.
 * Resolved entirely in the route so the client form receives fully-formed objects (no client
 * re-lookup by id).
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
  const session = await getSession();
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

  // The offered recipients come from the same "who can access this workspace" source the enable-time
  // gate and the runner's send-time backstop check against (`getWorkspaceMemberEmails`), so the
  // picker can never offer an address the runtime would refuse to send to — and stops offering one
  // as soon as that access is revoked (ENG-2186).
  const [workflow, workspaceMembers, userEmail, locale] = await Promise.all([
    workflowsService.getWorkflowById(workflowId),
    getWorkspaceMembers(workspaceId),
    getUserEmail(session.user.id),
    getUserLocale(session.user.id),
  ]);

  // Only serve context for a workflow that belongs to the URL workspace (defense in depth; the page
  // auth already gates workspace access).
  if (workflow?.workspaceId !== workspaceId) {
    return { ...emptyContext, userEmail: userEmail ?? "", locale: locale ?? DEFAULT_LOCALE };
  }

  // The trigger `surveyId` is author-set but NOT workspace-validated by the workflow patch handler, so a
  // member could point it at another workspace's survey. Scope by `workspaceId` here (IDOR guard); a
  // non-matching or missing survey resolves to null and the form degrades to plain inputs.
  const surveyId = readTriggerSurveyId(workflow.definition);
  const loadedSurvey = surveyId ? await getSurvey(surveyId).catch(() => null) : null;
  const survey = loadedSurvey?.workspaceId === workspaceId ? loadedSurvey : null;

  return {
    survey,
    teamMemberDetails: workspaceMembers,
    userEmail: userEmail ?? "",
    mailFrom,
    locale: locale ?? DEFAULT_LOCALE,
  };
};

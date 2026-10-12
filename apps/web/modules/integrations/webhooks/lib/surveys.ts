import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveys } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";

// HOTFIX: not getting all surveys for now since it's maxing out the prisma accelerate limit.
const WEBHOOK_SURVEYS_LIMIT = 200;

/**
 * The surveys the webhooks page lists and offers in its picker for the signed-in user. The visibility
 * clause is resolved here (ENG-3282), so a plain member is never offered another user's restricted
 * survey: they get workspace-visible surveys plus their own restricted ones.
 */
export const getWebhookSurveys = async (
  workspaceId: string,
  userId: string,
  organizationId: string
): Promise<TSurvey[]> =>
  getSurveys(workspaceId, await getUserVisibleSurveyWhere(userId, organizationId), WEBHOOK_SURVEYS_LIMIT);

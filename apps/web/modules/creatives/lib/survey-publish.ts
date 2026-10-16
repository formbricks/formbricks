import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";
import { isAppSurveyMissingTriggersToPublish } from "@/lib/survey/publish-rule";

/** Whether any non-archived creative opens the survey (draft creatives count: they will open it). */
export const isSurveyOpenedByCreative = async (surveyId: string): Promise<boolean> =>
  (await prisma.creative.findFirst({ where: { surveyId, archivedAt: null }, select: { id: true } })) !== null;

/**
 * The publish rule as the server applies it to a stored survey (create has no creatives yet, so it calls
 * the rule directly). The creative lookup only runs for an app survey that has no trigger of its own.
 */
export const isAppSurveyBlockedFromPublishing = async ({
  surveyId,
  type,
  status,
  triggers,
}: {
  surveyId: string;
  type: TSurveyType;
  status: TSurveyStatus;
  triggers: readonly unknown[] | null | undefined;
}): Promise<boolean> =>
  isAppSurveyMissingTriggersToPublish({ type, status, triggers, isOpenedByCreative: false }) &&
  isAppSurveyMissingTriggersToPublish({
    type,
    status,
    triggers,
    isOpenedByCreative: await isSurveyOpenedByCreative(surveyId),
  });

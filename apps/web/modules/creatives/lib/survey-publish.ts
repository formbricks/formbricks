import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";
import { isAppSurveyMissingTriggersToPublish } from "@/lib/survey/publish-rule";
import { hasLinkedCreatives } from "./linked-creatives";

/** Whether a non-archived creative opens the survey (draft creatives count: they will open it). */
export const isSurveyOpenedByCreative = (survey: {
  surveyId: string;
  workspaceId: string;
}): Promise<boolean> => hasLinkedCreatives(prisma, survey);

/**
 * The publish rule as the server applies it to a stored survey (create has no creatives yet, so it calls
 * the rule directly). Linked creatives are only looked up for an app survey with no trigger of its own.
 */
export const isAppSurveyBlockedFromPublishing = async ({
  surveyId,
  workspaceId,
  type,
  status,
  triggers,
}: {
  surveyId: string;
  workspaceId: string;
  type: TSurveyType;
  status: TSurveyStatus;
  triggers: readonly unknown[] | null | undefined;
}): Promise<boolean> =>
  isAppSurveyMissingTriggersToPublish({ type, status, triggers, isOpenedByCreative: false }) &&
  isAppSurveyMissingTriggersToPublish({
    type,
    status,
    triggers,
    isOpenedByCreative: await isSurveyOpenedByCreative({ surveyId, workspaceId }),
  });

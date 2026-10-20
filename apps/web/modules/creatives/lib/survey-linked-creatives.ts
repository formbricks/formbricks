import "server-only";
import { prisma } from "@formbricks/database";
import { serializeV3Creative } from "@/app/api/v3/creatives/lib/serializers";
import { hasLinkedCreatives } from "./linked-creatives";
import { ACTIVE_CREATIVES_LIMIT } from "./list-api";
import { findCreativeRecordsPage } from "./repository";
import type { TSurveyLinkedCreative } from "./survey-side";

/** Whether creatives open the survey: any non-archived creative has it as its Destination. */
export const isSurveyOpenedByCreatives = (
  survey: Readonly<{ surveyId: string; workspaceId: string }>
): Promise<boolean> => hasLinkedCreatives(prisma, survey);

/**
 * The survey's linked creatives exactly as the survey screens read them from
 * `GET /api/v3/creatives?surveyId=` (non-archived, by name, one page at the API's ceiling), so a page can
 * hand them to `useSurveyLinkedCreatives` as its initial data instead of fetching them again on load.
 */
export const getSurveyLinkedCreatives = async (
  { surveyId, workspaceId }: Readonly<{ surveyId: string; workspaceId: string }>,
  now: Date = new Date()
): Promise<TSurveyLinkedCreative[]> => {
  const records = await findCreativeRecordsPage({
    workspaceId,
    surveyId,
    sortBy: "name",
    after: null,
    take: ACTIVE_CREATIVES_LIMIT,
    now,
  });
  return records.map((record) => {
    const { id, name, status, displayStatus, displayStatusReason, archivedAt, schedule } =
      serializeV3Creative(record, now);
    return { id, name, status, displayStatus, displayStatusReason, archivedAt, schedule };
  });
};

import "server-only";
import type { TV3DestructiveChange } from "@/app/api/v3/documents/lib/envelope";
import { isAppSurveyMissingTriggersToPublish } from "@/lib/survey/publish-rule";
import type { TCreativeState } from "@/modules/ee/creatives/lib/creative";
import { type TCreativeTx, findOpenedSurveyFacts } from "@/modules/ee/creatives/lib/repository";

/**
 * What a document push would remove from a live creative (ADR 0015, decision 5): the Destination it opens,
 * and with it, possibly, the only thing that opens a live app survey. A draft has nothing live to lose, and
 * an archived creative is refused before this is asked.
 */

type TDestination = TCreativeState["destination"];

const surveyIdOf = (destination: TDestination): string | null =>
  destination?.type === "survey" ? destination.surveyId : null;

const isSameDestination = (left: TDestination, right: TDestination): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The destructive changes `previous` to `next` makes, empty when it makes none. The survey read happens
 * only when a live creative stops opening its survey, inside the write's transaction.
 */
export const getDestructiveCreativeChanges = async ({
  tx,
  creativeId,
  workspaceId,
  previous,
  next,
}: {
  tx: TCreativeTx;
  creativeId: string;
  workspaceId: string;
  previous: TCreativeState;
  next: TCreativeState;
}): Promise<TV3DestructiveChange[]> => {
  const isLive = previous.status !== "draft" && previous.archivedAt === null;
  if (!isLive || previous.destination === null || isSameDestination(previous.destination, next.destination)) {
    return [];
  }

  const surveyId = surveyIdOf(previous.destination);
  const changes: TV3DestructiveChange[] = [
    {
      type: next.destination === null ? "destination_removed" : "destination_changed",
      ...(surveyId && { ids: [surveyId] }),
    },
  ];

  if (surveyId && surveyId !== surveyIdOf(next.destination)) {
    const survey = await findOpenedSurveyFacts(tx, surveyId, workspaceId, creativeId);
    if (
      survey?.status === "inProgress" &&
      isAppSurveyMissingTriggersToPublish({
        type: survey.type,
        status: survey.status,
        triggers: Array.from({ length: survey.triggerCount }, () => true),
        isOpenedByCreative: survey.otherOpenerCount > 0,
      })
    ) {
      changes.push({ type: "survey_left_unopened", ids: [surveyId] });
    }
  }

  return changes;
};

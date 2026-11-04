import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import type { TResponseData } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { type TResponseNotShown, getNotShownElementIds } from "@formbricks/types/surveys/not-shown";

/**
 * The blocks a not-shown record is resolved against, read in the write's own transaction. Skipped when
 * the record lists nothing, which is every write of a survey without show-if.
 */
const getSurveyBlocksForNotShown = async (
  prismaClient: Prisma.TransactionClient,
  surveyId: string,
  notShown: TResponseNotShown
): Promise<TSurveyBlock[]> => {
  if (!notShown.blocks?.length && !notShown.elements?.length) return [];
  const survey = await prismaClient.survey.findUnique({ where: { id: surveyId }, select: { blocks: true } });
  return survey?.blocks ?? [];
};

/**
 * `data` without an answer to anything the survey's not-shown record lists (ENG-6936, ADR 0024). The
 * same on a create and an update, so a response the survey creates finished (one page, or an older
 * bundle that sent a stale answer) keeps no answer to a question its respondent was not shown.
 * Returns `data` itself when nothing was removed.
 */
export const withoutNotShownAnswers = async <TData extends TResponseData>(
  prismaClient: Prisma.TransactionClient,
  surveyId: string,
  notShown: TResponseNotShown | null | undefined,
  data: TData
): Promise<TData> => {
  if (!notShown) return data;
  const blocks = await getSurveyBlocksForNotShown(prismaClient, surveyId, notShown);
  const notShownIds = [...getNotShownElementIds(notShown, blocks)].filter((elementId) => elementId in data);
  if (notShownIds.length === 0) return data;
  const next = { ...data };
  for (const elementId of notShownIds) delete next[elementId];
  return next;
};

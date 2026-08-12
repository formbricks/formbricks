import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TSurvey } from "@/modules/survey/list/types/surveys";

export const surveySelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  creator: {
    select: {
      name: true,
    },
  },
  status: true,
  publishOn: true,
  archivedAt: true,
  singleUse: true,
  workspaceId: true,
} satisfies Prisma.SurveySelect;

export type TSurveyRow = Prisma.SurveyGetPayload<{ select: typeof surveySelect }>;

export interface TSurveyResponseCounts {
  /** Every response, including partial ones. */
  total: number;
  /** Responses the respondent actually finished. */
  completed: number;
}

export async function getResponseCountsBySurveyIds(
  surveyIds: string[]
): Promise<Map<string, TSurveyResponseCounts>> {
  if (surveyIds.length === 0) {
    return new Map();
  }

  // Grouping by `finished` keeps both counts in a single query: the list shows the completed
  // count, while the total still gates the "this survey already has responses" edit warning.
  const responseCounts = await prisma.response.groupBy({
    by: ["surveyId", "finished"],
    where: {
      surveyId: {
        in: surveyIds,
      },
    },
    _count: {
      _all: true,
    },
  });

  const countsBySurveyId = new Map<string, TSurveyResponseCounts>();
  for (const { surveyId, finished, _count } of responseCounts) {
    const counts = countsBySurveyId.get(surveyId) ?? { total: 0, completed: 0 };
    counts.total += _count._all;
    if (finished) {
      counts.completed += _count._all;
    }
    countsBySurveyId.set(surveyId, counts);
  }

  return countsBySurveyId;
}

/** Shared so the default doesn't allocate a throwaway object per mapped row (Sonar S7737). */
const NO_RESPONSES: TSurveyResponseCounts = Object.freeze({ total: 0, completed: 0 });

export function mapSurveyRowToSurvey(
  row: TSurveyRow,
  responseCounts: TSurveyResponseCounts = NO_RESPONSES
): TSurvey {
  return {
    ...row,
    responseCount: responseCounts.total,
    completedResponseCount: responseCounts.completed,
  };
}

export function mapSurveyRowsToSurveys(
  rows: TSurveyRow[],
  responseCountsBySurveyId: Map<string, TSurveyResponseCounts> = new Map()
): TSurvey[] {
  return rows.map((row) => mapSurveyRowToSurvey(row, responseCountsBySurveyId.get(row.id)));
}

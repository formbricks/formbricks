import { Prisma } from "@prisma/client";
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
  singleUse: true,
  environmentId: true,
  _count: {
    select: { responses: true },
  },
} satisfies Prisma.SurveySelect;

export type TSurveyRow = Prisma.SurveyGetPayload<{ select: typeof surveySelect }>;

export function mapSurveyRowToSurvey(row: TSurveyRow): TSurvey {
  const { _count, ...survey } = row;

  return {
    ...survey,
    responseCount: _count.responses,
  };
}

export function mapSurveyRowsToSurveys(rows: TSurveyRow[]): TSurvey[] {
  return rows.map(mapSurveyRowToSurvey);
}

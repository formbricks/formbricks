import "server-only";
import { Prisma } from "@prisma/client";
import { generateObject } from "ai";
import { z } from "zod";
import { TSegment } from "@formbricks/types/segment";
import {
  TSurvey,
  TSurveyFilterCriteria,
  TSurveyQuestion,
  TSurveyQuestions,
} from "@formbricks/types/surveys/types";
import { llmModel } from "../ai";

export const transformPrismaSurvey = (surveyPrisma: any): TSurvey => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
    };
  }

  const transformedSurvey: TSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  };

  return transformedSurvey;
};

export const buildWhereClause = (filterCriteria?: TSurveyFilterCriteria) => {
  const whereClause: Prisma.SurveyWhereInput["AND"] = [];

  // for name
  if (filterCriteria?.name) {
    whereClause.push({ name: { contains: filterCriteria.name, mode: "insensitive" } });
  }

  // for status
  if (filterCriteria?.status && filterCriteria?.status?.length) {
    whereClause.push({ status: { in: filterCriteria.status } });
  }

  // for type
  if (filterCriteria?.type && filterCriteria?.type?.length) {
    whereClause.push({ type: { in: filterCriteria.type } });
  }

  // for createdBy
  if (filterCriteria?.createdBy?.value && filterCriteria?.createdBy?.value?.length) {
    if (filterCriteria.createdBy.value.length === 1) {
      if (filterCriteria.createdBy.value[0] === "you") {
        whereClause.push({ createdBy: filterCriteria.createdBy.userId });
      }
      if (filterCriteria.createdBy.value[0] === "others") {
        whereClause.push({
          OR: [
            {
              createdBy: {
                not: filterCriteria.createdBy.userId,
              },
            },
            {
              createdBy: null,
            },
          ],
        });
      }
    }
  }

  return { AND: whereClause };
};

export const buildOrderByClause = (
  sortBy?: TSurveyFilterCriteria["sortBy"]
): Prisma.SurveyOrderByWithRelationInput[] | undefined => {
  const orderMapping: { [key: string]: Prisma.SurveyOrderByWithRelationInput } = {
    name: { name: "asc" },
    createdAt: { createdAt: "desc" },
    updatedAt: { updatedAt: "desc" },
  };

  return sortBy ? [orderMapping[sortBy] || { updatedAt: "desc" }] : undefined;
};

export const anySurveyHasFilters = (surveys: TSurvey[]): boolean => {
  return surveys.some((survey) => {
    if ("segment" in survey && survey.segment) {
      return survey.segment.filters && survey.segment.filters.length > 0;
    }
    return false;
  });
};

export const doesSurveyHasOpenTextQuestion = (questions: TSurveyQuestions): boolean => {
  return questions.some((question) => question.type === "openText");
};

export const getInsightsEnabled = async (question: TSurveyQuestion): Promise<boolean> => {
  const { object } = await generateObject({
    model: llmModel,
    schema: z.object({
      insightsEnabled: z.boolean(),
    }),
    prompt: `Please evaluate the following survey question to determine if it is suitable for generating insights. Does it make sense to generate insights for this question: ${question.headline.default}`,
    experimental_telemetry: { isEnabled: true },
  });

  return object.insightsEnabled;
};

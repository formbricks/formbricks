import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestion, TSurveyQuestions } from "@formbricks/types/surveys/types";
import { llmModel } from "../aiModels";

export const transformPrismaSurvey = <T extends TSurvey | TJsEnvironmentStateSurvey>(
  surveyPrisma: any
): T => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
    };
  }

  const transformedSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  } as T;

  return transformedSurvey;
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
  try {
    const { object } = await generateObject({
      model: llmModel,
      schema: z.object({
        insightsEnabled: z.boolean(),
      }),
      prompt: `We extract insights (e.g. feature requests, complaints, other) from survey questions. Can we find them in this question?: ${question.headline.default}`,
      experimental_telemetry: { isEnabled: true },
    });

    return object.insightsEnabled;
  } catch (error) {
    throw error;
  }
};

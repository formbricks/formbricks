import "server-only";
import { CRON_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { doesSurveyHasOpenTextQuestion } from "@formbricks/lib/survey/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

export const generateInsightsForSurvey = (surveyId: string) => {
  if (!CRON_SECRET) {
    throw new Error("CRON_SECRET is not set");
  }

  try {
    return fetch(`${WEBAPP_URL}/api/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CRON_SECRET,
      },
      body: JSON.stringify({
        surveyId,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: new Error(`Error while generating insights for survey: ${error.message}`),
    };
  }
};

export const generateInsightsEnabledForSurveyQuestions = async (
  surveyId: string
): Promise<
  | {
      success: false;
    }
  | {
      success: true;
      survey: Pick<TSurvey, "id" | "name" | "environmentId" | "questions">;
    }
> => {
  validateInputs([surveyId, ZId]);
  try {
    const survey = await getSurvey(surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (!doesSurveyHasOpenTextQuestion(survey.questions)) {
      return { success: false };
    }

    const openTextQuestions = survey.questions.filter((question) => question.type === "openText");

    const openTextQuestionsWithoutInsightsEnabled = openTextQuestions.filter(
      (question) => question.type === "openText" && typeof question.insightsEnabled === "undefined"
    );

    if (openTextQuestionsWithoutInsightsEnabled.length === 0) {
      return { success: false };
    }

    const updatedSurvey = await updateSurvey(survey);

    if (!updatedSurvey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const doesSurveyHasInsightsEnabledQuestion = updatedSurvey.questions.some(
      (question) => question.type === "openText" && question.insightsEnabled === true
    );

    surveyCache.revalidate({ id: surveyId, environmentId: survey.environmentId });

    if (doesSurveyHasInsightsEnabledQuestion) {
      return { success: true, survey: updatedSurvey };
    }

    return { success: false };
  } catch (error) {
    logger.error(error, "Error generating insights for surveys");
    throw error;
  }
};

export const doesResponseHasAnyOpenTextAnswer = (
  openTextQuestionIds: string[],
  response: TResponse["data"]
): boolean => {
  return openTextQuestionIds.some((questionId) => {
    const answer = response[questionId];
    return typeof answer === "string" && answer.length > 0;
  });
};

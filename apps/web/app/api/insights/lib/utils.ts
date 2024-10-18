import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { CRON_SECRET, WEBAPP_URL } from "@formbricks/lib/constants";
import { documentCache } from "@formbricks/lib/document/cache";
import { createDocument } from "@formbricks/lib/document/service";
import { handleInsightAssignments } from "@formbricks/lib/document/utils";
import { doesThisResponseHasAnyOpenTextAnswer } from "@formbricks/lib/response/utils";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { doesSurveyHasOpenTextQuestion, getInsightsEnabled } from "@formbricks/lib/survey/utils";
import { getPromptText } from "@formbricks/lib/utils/ai";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TSurvey,
  TSurveyQuestionTypeEnum,
  TSurveyQuestions,
  ZSurveyQuestions,
} from "@formbricks/types/surveys/types";

export const generateInsightsForSurvey = (surveyId: string) => {
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
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        id: true,
        name: true,
        environmentId: true,
        questions: true,
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (!doesSurveyHasOpenTextQuestion(survey.questions)) {
      return { success: false };
    }

    const openTextQuestions = survey.questions.filter((question) => question.type === "openText");

    const insightsEnabledValues = await Promise.all(
      openTextQuestions.map(async (question) => {
        const insightsEnabled = await getInsightsEnabled(question);

        return { id: question.id, insightsEnabled };
      })
    );

    const insightsEnabledQuestionIds = insightsEnabledValues
      .filter((value) => value.insightsEnabled)
      .map((value) => value.id);

    const updatedQuestions = survey.questions.map((question) => {
      if (question.type === "openText") {
        const areInsightsEnabled = insightsEnabledQuestionIds.includes(question.id);
        return {
          ...question,
          insightsEnabled: areInsightsEnabled,
        };
      }

      return question;
    });

    const updatedSurvey = await prisma.survey.update({
      where: {
        id: survey.id,
      },
      data: {
        questions: updatedQuestions,
      },
      select: {
        id: true,
        name: true,
        environmentId: true,
        questions: true,
      },
    });

    surveyCache.revalidate({ id: surveyId, environmentId: survey.environmentId });

    if (insightsEnabledQuestionIds.length > 0) {
      return { success: true, survey: updatedSurvey };
    }

    return { success: false };
  } catch (error) {
    console.error("Error generating insights for surveys:", error);
    throw error;
  }
};

export const generateInsightsForSurveyResponses = async (surveyData: {
  id: string;
  name: string;
  environmentId: string;
  questions: TSurveyQuestions;
}): Promise<void> => {
  const { id: surveyId, name, environmentId, questions } = surveyData;

  validateInputs([surveyId, ZId], [environmentId, ZId], [questions, ZSurveyQuestions]);
  try {
    const openTextQuestionsWithInsights = questions.filter(
      (question) => question.type === TSurveyQuestionTypeEnum.OpenText && question.insightsEnabled
    );

    const openTextQuestionIds = openTextQuestionsWithInsights.map((question) => question.id);

    if (openTextQuestionIds.length === 0) {
      return;
    }

    // Fetching responses
    const batchSize = 200;
    let skip = 0;

    const totalResponseCount = await prisma.response.count({
      where: {
        surveyId,
        documents: {
          none: {},
        },
        finished: true,
      },
    });

    const pages = Math.ceil(totalResponseCount / batchSize);

    for (let i = 0; i < pages; i++) {
      const responses = await prisma.response.findMany({
        where: {
          surveyId,
          documents: {
            none: {},
          },
          finished: true,
        },
        select: {
          id: true,
          data: true,
        },
        take: batchSize,
        skip,
      });

      const responsesWithOpenTextAnswers = responses.filter((response) =>
        doesThisResponseHasAnyOpenTextAnswer(openTextQuestionIds, response.data)
      );

      skip += batchSize - responsesWithOpenTextAnswers.length;

      const createDocumentPromises = responsesWithOpenTextAnswers.map((response) => {
        return Promise.all(
          openTextQuestionsWithInsights.map(async (question) => {
            const responseText = response.data[question.id] as string;
            if (!responseText) {
              return;
            }

            const text = getPromptText(question.headline.default, responseText);

            return await createDocument(name, {
              environmentId,
              surveyId,
              responseId: response.id,
              questionId: question.id,
              text,
            });
          })
        );
      });

      const createDocumentResults = await Promise.all(createDocumentPromises);
      const createdDocuments = createDocumentResults.flat().filter(Boolean);

      for (const document of createdDocuments) {
        if (document) {
          const insightPromises: Promise<void>[] = [];
          const { insights, isSpam, id, environmentId } = document;
          if (!isSpam) {
            for (const insight of insights) {
              if (typeof insight.title !== "string" || typeof insight.description !== "string") {
                throw new Error("Insight title and description must be a string");
              }

              // create or connect the insight
              insightPromises.push(handleInsightAssignments(environmentId, id, insight));
            }
            await Promise.all(insightPromises);
          }
        }
      }
      documentCache.revalidate({
        environmentId: environmentId,
        surveyId: surveyId,
      });
    }
    return;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

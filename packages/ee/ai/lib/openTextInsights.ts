import { getSurvey } from "@formbricks/lib/survey/service";
import { getResponses } from "@formbricks/lib/response/service";
import { TSurveyQuestionSummary, TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";
import { askAi } from "../api/ask";
import { unstable_cache } from "next/cache";
import { OPENAI_REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

export const getOpenTextInsights = async (surveyId: string) =>
  unstable_cache(
    async () => {
      const survey = await getSurvey(surveyId);
      if (!survey) {
        throw new Error("Survey not Found");
      }

      const surveyResponses = await getResponses(surveyId);

      const getSummaryData = (): TSurveyQuestionSummary<TSurveyQuestion>[] =>
        survey.questions.map((question) => {
          const questionResponses = surveyResponses
            .filter((response) => question.id in response.data)
            .map((r) => ({
              id: r.id,
              value: r.data[question.id],
              updatedAt: r.updatedAt,
              person: r.person,
            }));
          return {
            question,
            responses: questionResponses,
          };
        });

      const [openTextResponses] = getSummaryData().map((questionSummary) => {
        if (questionSummary.question.type === TSurveyQuestionType.OpenText) {
          if (questionSummary.responses.length > 10) {
            return questionSummary.responses.sort(() => 0.5 - Math.random()).slice(0, 10);
          }
          return questionSummary.responses;
        }
      });
      if (!openTextResponses) {
        throw new Error("No Open Text Responses");
      }

      const allAnswers = openTextResponses
        .filter((response) => response.value.toString().length >= 2)
        .map((response) => response.value.toString().trim())
        .join(", ");

      const summaryWithAi = await askAi(
        "The following are all the responses I have received in a survey. Combine them all and then give me 3 insights, where each insight is separated by a new line character",
        allAnswers
      );

      return summaryWithAi;
    },
    [`getOpenTextInsights-${surveyId}`],
    {
      revalidate: OPENAI_REVALIDATION_INTERVAL,
    }
  )();

import { getResponses } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { askAi } from "../api/ask";

export const getOpenTextInsights = async (surveyId: string, questionId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not Found");
  }

  const question = survey.questions.find((question) => question.id === questionId);

  const surveyResponses = await getResponses(surveyId);
  let questionResponses = surveyResponses.map((response) => response.data[questionId]);

  // Remove empty responses
  questionResponses = questionResponses.filter((response) => response);
  // randomize responses and take the first 50
  questionResponses = questionResponses.sort(() => 0.5 - Math.random()).slice(0, 50);

  const summaryWithAi = await askAi(
    `You are  survey analyst. We have asked our users the following question: ${question?.headline}
Introduce the findings with aone sentence summary and determine up to ${
      questionResponses.length > 40 ? "5" : "4"
    } categories most answers fall into. Write a brief description for every category (up to 2 sentences) and provide an example answer from the list of answers for each category.
\`\`\`answers
${questionResponses.join("\n")}}`
  );

  return summaryWithAi;
};

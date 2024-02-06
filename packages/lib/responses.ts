import { TResponse } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";

export const getQuestionResponseMapping = (
  survey: { questions: TSurveyQuestion[] },
  response: TResponse
): { question: string; answer: string; type: TSurveyQuestionType }[] => {
  const questionResponseMapping: { question: string; answer: string; type: TSurveyQuestionType }[] = [];

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    questionResponseMapping.push({
      question: question.headline,
      answer: typeof answer !== "undefined" ? answer.toString() : "",
      type: question.type,
    });
  }

  return questionResponseMapping;
};

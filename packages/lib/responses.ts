import { Question } from "@formbricks/types/questions";
import { TResponse } from "@formbricks/types/v1/responses";

export const getQuestionResponseMapping = (
  survey: { questions: Question[] },
  response: TResponse
): { question: string; answer: string }[] => {
  const questionResponseMapping: { question: string; answer: string }[] = [];

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    questionResponseMapping.push({
      question: question.headline,
      answer: typeof answer !== "undefined" ? answer.toString() : "",
    });
  }

  return questionResponseMapping;
};

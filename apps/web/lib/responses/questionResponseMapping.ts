import { Question } from "@formbricks/types/questions";
import { Response } from "@formbricks/types/responses";

export const getQuestionResponseMapping = (
  survey: { questions: Question[] },
  response: Response
): { question: string; answer: string }[] => {
  const questionResponseMapping: { question: string; answer: string }[] = [];

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    questionResponseMapping.push({
      question: question.headline,
      answer,
    });
  }

  return questionResponseMapping;
};

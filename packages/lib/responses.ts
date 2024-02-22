import { TResponse } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";

export const getQuestionResponseMapping = (
  survey: { questions: TSurveyQuestion[] },
  response: TResponse
): { question: string; answer: string | string[]; type: TSurveyQuestionType }[] => {
  const questionResponseMapping: {
    question: string;
    answer: string | string[];
    type: TSurveyQuestionType;
  }[] = [];

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    const getAnswer = () => {
      if (!answer) return "";
      else {
        if (question.type === "fileUpload") {
          if (typeof answer === "string") {
            return [answer];
          } else {
            return answer as string[];
            // as array
          }
        } else {
          return answer.toString();
        }
      }
    };

    questionResponseMapping.push({
      question: question.headline,
      answer: getAnswer(),
      type: question.type,
    });
  }

  return questionResponseMapping;
};

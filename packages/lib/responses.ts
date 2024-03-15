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

export const processAnswer = (answer: string | number | string[] | Record<string, string>) => {
  if (typeof answer === "string" || typeof answer === "number") {
    return answer;
  } else if (Array.isArray(answer)) {
    return answer.join("; ");
  } else {
    const formattedString = Object.entries(answer)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return formattedString;
  }
};

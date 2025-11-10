import { TResponseData } from "@formbricks/types/responses";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { getQuestionsFromBlocks } from "@/modules/survey/editor/lib/blocks";

export const getPrefillValue = (
  survey: TSurvey,
  searchParams: URLSearchParams,
  languageId: string
): TResponseData | undefined => {
  const prefillAnswer: TResponseData = {};

  const questions = getQuestionsFromBlocks(survey.blocks);
  const questionIdxMap = questions.reduce(
    (acc, question, idx) => {
      acc[question.id] = idx;
      return acc;
    },
    {} as Record<string, number>
  );

  searchParams.forEach((value, key) => {
    if (FORBIDDEN_IDS.includes(key)) return;
    const questionId = key;
    const questionIdx = questionIdxMap[questionId];
    const question = questions[questionIdx];
    const answer = value;
    if (question) {
      if (checkValidity(question, answer, languageId)) {
        prefillAnswer[questionId] = transformAnswer(question, answer, languageId);
      }
    }
  });

  return Object.keys(prefillAnswer).length > 0 ? prefillAnswer : undefined;
};

const checkValidity = (question: TSurveyElement, answer: string, language: string): boolean => {
  if (question.required && (!answer || answer === "")) return false;
  try {
    switch (question.type) {
      case TSurveyElementTypeEnum.OpenText: {
        return true;
      }
      case TSurveyElementTypeEnum.MultipleChoiceSingle: {
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (!question.choices.find((choice) => choice.label[language] === answer)) return false;
          return true;
        }

        if (question.choices[question.choices.length - 1].label[language] === answer) {
          return false;
        }

        return true;
      }
      case TSurveyElementTypeEnum.MultipleChoiceMulti: {
        const answerChoices = answer.split(",");
        const hasOther = question.choices[question.choices.length - 1].id === "other";
        if (!hasOther) {
          if (
            !answerChoices.every((ans: string) =>
              question.choices.find((choice) => choice.label[language] === ans)
            )
          )
            return false;
          return true;
        }
        return true;
      }
      case TSurveyElementTypeEnum.NPS: {
        const cleanedAnswer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(cleanedAnswer));

        if (isNaN(answerNumber)) return false;
        if (answerNumber < 0 || answerNumber > 10) return false;
        return true;
      }
      case TSurveyElementTypeEnum.CTA: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "clicked" && answer !== "dismissed") return false;
        return true;
      }
      case TSurveyElementTypeEnum.Consent: {
        if (question.required && answer === "dismissed") return false;
        if (answer !== "accepted" && answer !== "dismissed") return false;
        return true;
      }
      case TSurveyElementTypeEnum.Rating: {
        const cleanedAnswer = answer.replace(/&/g, ";");
        const answerNumber = Number(JSON.parse(cleanedAnswer));
        if (answerNumber < 1 || answerNumber > question.range) return false;
        return true;
      }
      case TSurveyElementTypeEnum.PictureSelection: {
        const answerChoices = answer.split(",");
        return answerChoices.every((ans: string) => !isNaN(Number(ans)));
      }
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
};

const transformAnswer = (
  question: TSurveyElement,
  answer: string,
  language: string
): string | number | string[] => {
  switch (question.type) {
    case TSurveyElementTypeEnum.OpenText:
    case TSurveyElementTypeEnum.MultipleChoiceSingle: {
      return answer;
    }
    case TSurveyElementTypeEnum.Consent:
    case TSurveyElementTypeEnum.CTA: {
      if (answer === "dismissed") return "";
      return answer;
    }

    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.NPS: {
      const cleanedAnswer = answer.replace(/&/g, ";");
      return Number(JSON.parse(cleanedAnswer));
    }

    case TSurveyElementTypeEnum.PictureSelection: {
      const answerChoicesIdx = answer.split(",");
      const answerArr: string[] = [];

      answerChoicesIdx.forEach((ansIdx) => {
        const choice = question.choices[Number(ansIdx) - 1];
        if (choice) answerArr.push(choice.id);
      });

      if (question.allowMulti) return answerArr;
      return answerArr.slice(0, 1);
    }

    case TSurveyElementTypeEnum.MultipleChoiceMulti: {
      let ansArr = answer.split(",");
      const hasOthers = question.choices[question.choices.length - 1].id === "other";
      if (!hasOthers) return ansArr;

      // answer can be "a,b,c,d" and options can be a,c,others so we are filtering out the options that are not in the options list and sending these non-existing values as a single string(representing others) like "a", "c", "b,d"
      const options = question.choices.map((o) => o.label[language]);
      const others = ansArr.filter((a: string) => !options.includes(a));
      if (others.length > 0) ansArr = ansArr.filter((a: string) => options.includes(a));
      if (others.length > 0) ansArr.push(others.join(","));
      return ansArr;
    }

    default:
      return "";
  }
};

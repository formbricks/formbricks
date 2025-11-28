import { TResponseData } from "@formbricks/types/responses";
import {
  TSurveyCTAElement,
  TSurveyConsentElement,
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyMultipleChoiceElement,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

export const getPrefillValue = (
  survey: TSurvey,
  searchParams: URLSearchParams,
  languageId: string
): TResponseData | undefined => {
  const prefillAnswer: TResponseData = {};

  const questions = getElementsFromBlocks(survey.blocks);
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

const validateOpenText = (): boolean => {
  return true;
};

const validateMultipleChoiceSingle = (
  question: TSurveyMultipleChoiceElement,
  answer: string,
  language: string
): boolean => {
  if (question.type !== TSurveyElementTypeEnum.MultipleChoiceSingle) return false;
  const choices = question.choices;
  const hasOther = choices[choices.length - 1].id === "other";

  if (!hasOther) {
    return choices.some((choice) => choice.label[language] === answer);
  }

  const matchesAnyChoice = choices.some((choice) => choice.label[language] === answer);

  if (matchesAnyChoice) {
    return true;
  }

  const trimmedAnswer = answer.trim();
  return trimmedAnswer !== "";
};

const validateMultipleChoiceMulti = (question: TSurveyElement, answer: string, language: string): boolean => {
  if (question.type !== TSurveyElementTypeEnum.MultipleChoiceMulti) return false;
  const choices = (
    question as TSurveyElement & { choices: Array<{ id: string; label: Record<string, string> }> }
  ).choices;
  const hasOther = choices[choices.length - 1].id === "other";
  const lastChoiceLabel = hasOther ? choices[choices.length - 1].label[language] : undefined;

  const answerChoices = answer
    .split(",")
    .map((ans) => ans.trim())
    .filter((ans) => ans !== "");

  if (answerChoices.length === 0) {
    return false;
  }

  if (!hasOther) {
    return answerChoices.every((ans: string) => choices.some((choice) => choice.label[language] === ans));
  }

  let freeTextOtherCount = 0;
  for (const ans of answerChoices) {
    const matchesChoice = choices.some((choice) => choice.label[language] === ans);

    if (matchesChoice) {
      continue;
    }

    if (ans === lastChoiceLabel) {
      continue;
    }

    freeTextOtherCount++;
    if (freeTextOtherCount > 1) {
      return false;
    }
  }

  return true;
};

const validateNPS = (answer: string): boolean => {
  try {
    const cleanedAnswer = answer.replace(/&/g, ";");
    const answerNumber = Number(JSON.parse(cleanedAnswer));
    return !isNaN(answerNumber) && answerNumber >= 0 && answerNumber <= 10;
  } catch {
    return false;
  }
};

const validateCTA = (question: TSurveyCTAElement, answer: string): boolean => {
  if (question.required && answer === "dismissed") return false;
  return answer === "clicked" || answer === "dismissed";
};

const validateConsent = (question: TSurveyConsentElement, answer: string): boolean => {
  if (question.required && answer === "dismissed") return false;
  return answer === "accepted" || answer === "dismissed";
};

const validateRating = (question: TSurveyRatingElement, answer: string): boolean => {
  if (question.type !== TSurveyElementTypeEnum.Rating) return false;
  const ratingQuestion = question;
  try {
    const cleanedAnswer = answer.replace(/&/g, ";");
    const answerNumber = Number(JSON.parse(cleanedAnswer));
    return answerNumber >= 1 && answerNumber <= (ratingQuestion.range ?? 5);
  } catch {
    return false;
  }
};

const validatePictureSelection = (answer: string): boolean => {
  const answerChoices = answer.split(",");
  return answerChoices.every((ans: string) => !isNaN(Number(ans)));
};

const checkValidity = (question: TSurveyElement, answer: string, language: string): boolean => {
  if (question.required && (!answer || answer === "")) return false;

  const validators: Partial<
    Record<TSurveyElementTypeEnum, (q: TSurveyElement, a: string, l: string) => boolean>
  > = {
    [TSurveyElementTypeEnum.OpenText]: () => validateOpenText(),
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: (q, a, l) =>
      validateMultipleChoiceSingle(q as TSurveyMultipleChoiceElement, a, l),
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: (q, a, l) => validateMultipleChoiceMulti(q, a, l),
    [TSurveyElementTypeEnum.NPS]: (_, a) => validateNPS(a),
    [TSurveyElementTypeEnum.CTA]: (q, a) => validateCTA(q as TSurveyCTAElement, a),
    [TSurveyElementTypeEnum.Consent]: (q, a) => validateConsent(q as TSurveyConsentElement, a),
    [TSurveyElementTypeEnum.Rating]: (q, a) => validateRating(q as TSurveyRatingElement, a),
    [TSurveyElementTypeEnum.PictureSelection]: (_, a) => validatePictureSelection(a),
  };

  const validator = validators[question.type];
  if (!validator) return false;

  try {
    return validator(question, answer, language);
  } catch {
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

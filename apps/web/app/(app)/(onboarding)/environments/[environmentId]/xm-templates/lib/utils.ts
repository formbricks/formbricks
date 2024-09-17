import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TProduct } from "@formbricks/types/product";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";

export const replaceQuestionPresetPlaceholders = (
  question: TSurveyQuestion,
  product: TProduct
): TSurveyQuestion => {
  if (!product) return question;
  const newQuestion = structuredClone(question);
  const defaultLanguageCode = "default";
  if (newQuestion.headline) {
    newQuestion.headline[defaultLanguageCode] = getLocalizedValue(
      newQuestion.headline,
      defaultLanguageCode
    ).replace("{{productName}}", product.name);
  }
  if (newQuestion.subheader) {
    newQuestion.subheader[defaultLanguageCode] = getLocalizedValue(
      newQuestion.subheader,
      defaultLanguageCode
    )?.replace("{{productName}}", product.name);
  }
  return newQuestion;
};

// replace all occurences of productName with the actual product name in the current template
export const replacePresetPlaceholders = (template: TXMTemplate, product: TProduct) => {
  const survey = structuredClone(template);
  survey.name = survey.name.replace("{{productName}}", product.name);
  survey.questions = survey.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, product);
  });
  return { ...template, ...survey };
};

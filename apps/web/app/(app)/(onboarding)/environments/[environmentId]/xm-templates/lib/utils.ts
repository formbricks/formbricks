import { replaceQuestionPresetPlaceholders } from "@formbricks/lib/utils/templates";
import { TProduct } from "@formbricks/types/product";
import { TXMTemplate } from "@formbricks/types/templates";

// replace all occurences of productName with the actual product name in the current template
export const replacePresetPlaceholders = (template: TXMTemplate, product: TProduct) => {
  const survey = structuredClone(template);
  survey.name = survey.name.replace("{{productName}}", product.name);
  survey.questions = survey.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, product);
  });
  return { ...template, ...survey };
};

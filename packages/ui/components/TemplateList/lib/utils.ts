import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { TProduct, TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";

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
export const replacePresetPlaceholders = (template: TTemplate, product: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("{{productName}}", product.name);
  preset.questions = preset.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, product);
  });
  return { ...template, preset };
};

export const channelMapping: {
  value: TProductConfigChannel;
  label: string;
}[] = [
  { value: "website", label: "common.website_survey" },
  { value: "app", label: "common.app_survey" },
  { value: "link", label: "common.link_survey" },
];

export const industryMapping: { value: TProductConfigIndustry; label: string }[] = [
  { value: "eCommerce", label: "common.e_commerce" },
  { value: "saas", label: "common.saas" },
  { value: "other", label: "common.other" },
];

export const roleMapping: { value: TTemplateRole; label: string }[] = [
  { value: "productManager", label: "common.product_manager" },
  { value: "customerSuccess", label: "common.customer_success" },
  { value: "marketing", label: "common.marketing" },
  { value: "sales", label: "common.sales" },
];

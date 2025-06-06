import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { TFnType } from "@tolgee/react";
import { TProject, TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";

export const replaceQuestionPresetPlaceholders = (
  question: TSurveyQuestion,
  project: TProject
): TSurveyQuestion => {
  if (!project) return question;
  const newQuestion = structuredClone(question);
  const defaultLanguageCode = "default";
  if (newQuestion.headline) {
    newQuestion.headline[defaultLanguageCode] = getLocalizedValue(
      newQuestion.headline,
      defaultLanguageCode
    ).replace("$[projectName]", project.name);
  }
  if (newQuestion.subheader) {
    newQuestion.subheader[defaultLanguageCode] = getLocalizedValue(
      newQuestion.subheader,
      defaultLanguageCode
    )?.replace("$[projectName]", project.name);
  }
  return newQuestion;
};

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TTemplate, project: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("$[projectName]", project.name);
  preset.questions = preset.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, project);
  });
  return { ...template, preset };
};

export const getChannelMapping = (t: TFnType): { value: TProjectConfigChannel; label: string }[] => [
  { value: "website", label: t("common.website_survey") },
  { value: "app", label: t("common.app_survey") },
  { value: "link", label: t("common.link_survey") },
];

export const getIndustryMapping = (t: TFnType): { value: TProjectConfigIndustry; label: string }[] => [
  { value: "eCommerce", label: t("common.e_commerce") },
  { value: "saas", label: t("common.saas") },
  { value: "other", label: t("common.other") },
];

export const getRoleMapping = (t: TFnType): { value: TTemplateRole; label: string }[] => [
  { value: "productManager", label: t("common.product_manager") },
  { value: "customerSuccess", label: t("common.customer_success") },
  { value: "marketing", label: t("common.marketing") },
  { value: "sales", label: t("common.sales") },
  { value: "peopleManager", label: t("common.people_manager") },
];

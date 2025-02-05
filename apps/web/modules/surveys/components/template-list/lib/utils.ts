import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
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
    ).replace("{{projectName}}", project.name);
  }
  if (newQuestion.subheader) {
    newQuestion.subheader[defaultLanguageCode] = getLocalizedValue(
      newQuestion.subheader,
      defaultLanguageCode
    )?.replace("{{projectName}}", project.name);
  }
  return newQuestion;
};

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TTemplate, project: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("{{projectName}}", project.name);
  preset.questions = preset.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, project);
  });
  return { ...template, preset };
};

export const channelMapping: {
  value: TProjectConfigChannel;
  label: string;
}[] = [
  { value: "website", label: "common.website_survey" },
  { value: "app", label: "common.app_survey" },
  { value: "link", label: "common.link_survey" },
];

export const industryMapping: { value: TProjectConfigIndustry; label: string }[] = [
  { value: "eCommerce", label: "common.e_commerce" },
  { value: "saas", label: "common.saas" },
  { value: "other", label: "common.other" },
];

export const roleMapping: { value: TTemplateRole; label: string }[] = [
  { value: "productManager", label: "common.product_manager" },
  { value: "customerSuccess", label: "common.customer_success" },
  { value: "marketing", label: "common.marketing" },
  { value: "sales", label: "common.sales" },
  { value: "peopleManager", label: "common.people_manager" },
];

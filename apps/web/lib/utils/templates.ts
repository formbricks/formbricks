import type { TProject } from "@formbricks/types/project";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurveyQuestion } from "@formbricks/types/surveys/types";
import type { TTemplate } from "@formbricks/types/templates";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";

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

export const replaceElementPresetPlaceholders = (
  element: TSurveyElement,
  project: TProject
): TSurveyElement => {
  if (!project) return element;
  const newElement = structuredClone(element);
  const defaultLanguageCode = "default";

  if (newElement.headline) {
    newElement.headline[defaultLanguageCode] = getLocalizedValue(
      newElement.headline,
      defaultLanguageCode
    ).replace("$[projectName]", project.name);
  }

  if (newElement.subheader) {
    newElement.subheader[defaultLanguageCode] = getLocalizedValue(
      newElement.subheader,
      defaultLanguageCode
    )?.replace("$[projectName]", project.name);
  }

  return newElement;
};

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TTemplate, project: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("$[projectName]", project.name);

  // Handle blocks if present
  if (preset.blocks && preset.blocks.length > 0) {
    preset.blocks = preset.blocks.map((block) => ({
      ...block,
      elements: block.elements.map((element) => replaceElementPresetPlaceholders(element, project)),
    }));
  }

  // Handle questions for backward compatibility
  if (preset.questions && preset.questions.length > 0) {
    preset.questions = preset.questions.map((question) => {
      return replaceQuestionPresetPlaceholders(question, project);
    });
  }

  return { ...template, preset };
};

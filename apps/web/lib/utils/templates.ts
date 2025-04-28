import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { TProject } from "@formbricks/types/project";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";

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

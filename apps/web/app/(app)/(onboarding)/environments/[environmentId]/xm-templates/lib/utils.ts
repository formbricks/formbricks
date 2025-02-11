import { replaceQuestionPresetPlaceholders } from "@formbricks/lib/utils/templates";
import { TProject } from "@formbricks/types/project";
import { TXMTemplate } from "@formbricks/types/templates";

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TXMTemplate, project: TProject) => {
  const survey = structuredClone(template);
  survey.name = survey.name.replace("$[projectName]", project.name);
  survey.questions = survey.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, project);
  });
  return { ...template, ...survey };
};

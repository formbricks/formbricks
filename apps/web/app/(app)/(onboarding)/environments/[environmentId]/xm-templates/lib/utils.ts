import { TProject } from "@formbricks/types/project";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TXMTemplate } from "@formbricks/types/templates";
import { replaceElementPresetPlaceholders } from "@/lib/utils/templates";

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TXMTemplate, project: TProject): TXMTemplate => {
  const survey = structuredClone(template);

  const modifiedBlocks = survey.blocks.map((block: TSurveyBlock) => ({
    ...block,
    elements: block.elements.map((element) => replaceElementPresetPlaceholders(element, project)),
  }));

  return { ...survey, name: survey.name.replace("$[projectName]", project.name), blocks: modifiedBlocks };
};

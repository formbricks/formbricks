import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TXMTemplate } from "@formbricks/types/templates";
import { TWorkspace } from "@formbricks/types/workspace";
import { replaceElementPresetPlaceholders } from "@/lib/utils/templates";

// replace all occurences of workspaceName with the actual workspace name in the current template
export const replacePresetPlaceholders = (template: TXMTemplate, workspace: TWorkspace): TXMTemplate => {
  const survey = structuredClone(template);

  const modifiedBlocks = survey.blocks.map((block: TSurveyBlock) => ({
    ...block,
    elements: block.elements.map((element) => replaceElementPresetPlaceholders(element, workspace)),
  }));

  return { ...survey, name: survey.name.replace("$[workspaceName]", workspace.name), blocks: modifiedBlocks };
};

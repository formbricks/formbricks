import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TTemplate } from "@formbricks/types/templates";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";

export const replaceElementPresetPlaceholders = (
  element: TSurveyElement,
  workspace: TWorkspace
): TSurveyElement => {
  if (!workspace) return element;
  const newElement = structuredClone(element);
  const defaultLanguageCode = "default";

  if (newElement.headline) {
    newElement.headline[defaultLanguageCode] = getLocalizedValue(
      newElement.headline,
      defaultLanguageCode
    ).replace("$[workspaceName]", workspace.name);
  }

  if (newElement.subheader) {
    newElement.subheader[defaultLanguageCode] = getLocalizedValue(
      newElement.subheader,
      defaultLanguageCode
    )?.replace("$[workspaceName]", workspace.name);
  }

  return newElement;
};

// replace all occurences of workspaceName with the actual workspace name in the current template
export const replacePresetPlaceholders = (template: TTemplate, workspace: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("$[workspaceName]", workspace.name);

  // Handle blocks if present
  if (preset.blocks && preset.blocks.length > 0) {
    preset.blocks = preset.blocks.map((block) => ({
      ...block,
      elements: block.elements.map((element) => replaceElementPresetPlaceholders(element, workspace)),
    }));
  }

  return { ...template, preset };
};

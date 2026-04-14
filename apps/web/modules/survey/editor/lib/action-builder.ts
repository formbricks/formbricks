import { TFunction } from "i18next";
import { TActionClassInput } from "@formbricks/types/action-classes";

export const buildActionObject = (data: TActionClassInput, workspaceId: string, t: TFunction) => {
  if (data.type === "noCode") {
    return buildNoCodeAction(data, workspaceId, t);
  }
  return buildCodeAction(data, workspaceId, t);
};

export const buildNoCodeAction = (data: TActionClassInput, workspaceId: string, t: TFunction) => {
  if (data.type !== "noCode") {
    throw new Error(t("workspace.actions.invalid_action_type_no_code"));
  }

  const baseAction = {
    name: data.name.trim(),
    description: data.description,
    workspaceId,
    type: "noCode" as const,
    noCodeConfig: data.noCodeConfig,
  };

  if (data.noCodeConfig?.type === "click") {
    return {
      ...baseAction,
      noCodeConfig: {
        ...data.noCodeConfig,
        elementSelector: {
          cssSelector: data.noCodeConfig.elementSelector.cssSelector,
          innerHtml: data.noCodeConfig.elementSelector.innerHtml,
        },
      },
    };
  }

  return baseAction;
};

export const buildCodeAction = (data: TActionClassInput, workspaceId: string, t: TFunction) => {
  if (data.type !== "code") {
    throw new Error(t("workspace.actions.invalid_action_type_code"));
  }

  return {
    name: data.name.trim(),
    description: data.description,
    workspaceId,
    type: "code" as const,
    key: data.key,
  };
};

import { TFnType } from "@tolgee/react";
import { TActionClassInput } from "@formbricks/types/action-classes";

export const buildActionObject = (data: TActionClassInput, environmentId: string, t: TFnType) => {
  if (data.type === "noCode") {
    return buildNoCodeAction(data, environmentId, t);
  }
  return buildCodeAction(data, environmentId, t);
};

export const buildNoCodeAction = (data: TActionClassInput, environmentId: string, t: TFnType) => {
  if (data.type !== "noCode") {
    throw new Error(t("environments.actions.invalid_action_type_no_code"));
  }

  const baseAction = {
    name: data.name.trim(),
    description: data.description,
    environmentId,
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

export const buildCodeAction = (data: TActionClassInput, environmentId: string, t: TFnType) => {
  if (data.type !== "code") {
    throw new Error(t("environments.actions.invalid_action_type_code"));
  }

  return {
    name: data.name.trim(),
    description: data.description,
    environmentId,
    type: "code" as const,
    key: data.key,
  };
};

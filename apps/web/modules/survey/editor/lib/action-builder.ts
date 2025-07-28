import { TActionClassInput } from "@formbricks/types/action-classes";

export const buildActionObject = (data: TActionClassInput, environmentId: string) => {
  if (data.type === "noCode") {
    return buildNoCodeAction(data, environmentId);
  }
  return buildCodeAction(data, environmentId);
};

export const buildNoCodeAction = (data: TActionClassInput, environmentId: string) => {
  if (data.type !== "noCode") {
    throw new Error("Invalid action type for noCode action");
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

export const buildCodeAction = (data: TActionClassInput, environmentId: string) => {
  if (data.type !== "code") {
    throw new Error("Invalid action type for code action");
  }

  return {
    name: data.name.trim(),
    description: data.description,
    environmentId,
    type: "code" as const,
    key: data.key,
  };
};

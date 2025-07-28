import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { TActionClassInput } from "@formbricks/types/action-classes";

export const validatePermissions = (isReadOnly: boolean, t: any) => {
  if (isReadOnly) {
    throw new Error(t("common.you_are_not_authorised_to_perform_this_action"));
  }
};

export const validateActionNames = (data: TActionClassInput, actionClassNames: string[], t: any) => {
  if (data.name && actionClassNames.includes(data.name)) {
    throw new Error(t("environments.actions.action_with_name_already_exists", { name: data.name }));
  }
};

export const validateActionKeys = (data: TActionClassInput, actionClassKeys: string[], t: any) => {
  if (data.type === "code" && data.key && actionClassKeys.includes(data.key)) {
    throw new Error(t("environments.actions.action_with_key_already_exists", { key: data.key }));
  }
};

export const validateCssSelector = (data: TActionClassInput, t: any) => {
  if (
    data.type === "noCode" &&
    data.noCodeConfig?.type === "click" &&
    data.noCodeConfig.elementSelector.cssSelector &&
    !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
  ) {
    throw new Error(t("environments.actions.invalid_css_selector"));
  }
};

export const validateRegexPatterns = (data: TActionClassInput, t: any) => {
  if (data.type === "noCode" && data.noCodeConfig?.urlFilters) {
    for (const urlFilter of data.noCodeConfig.urlFilters) {
      if (urlFilter.rule === "matchesRegex") {
        try {
          new RegExp(urlFilter.value);
        } catch {
          throw new Error(t("environments.actions.invalid_regex"));
        }
      }
    }
  }
};

export const validateActionData = (
  data: TActionClassInput,
  isReadOnly: boolean,
  actionClassNames: string[],
  actionClassKeys: string[],
  t: any
) => {
  validatePermissions(isReadOnly, t);
  validateActionNames(data, actionClassNames, t);
  validateActionKeys(data, actionClassKeys, t);
  validateCssSelector(data, t);
  validateRegexPatterns(data, t);
};

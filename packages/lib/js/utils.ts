import {
  TActionClass,
  TActionClassNoCodeConfig,
  TActionClassPageUrlRule,
} from "@formbricks/types/actionClasses";
import { TJsTrackProperties } from "@formbricks/types/js";
import { TResponseHiddenFieldValue } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { Logger } from "./logger";

const logger = Logger.getInstance();

export const checkUrlMatch = (
  url: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule
): boolean => {
  switch (pageUrlRule) {
    case "exactMatch":
      return url === pageUrlValue;
    case "contains":
      return url.includes(pageUrlValue);
    case "startsWith":
      return url.startsWith(pageUrlValue);
    case "endsWith":
      return url.endsWith(pageUrlValue);
    case "notMatch":
      return url !== pageUrlValue;
    case "notContains":
      return !url.includes(pageUrlValue);
    default:
      return false;
  }
};

export const handleUrlFilters = (urlFilters: TActionClassNoCodeConfig["urlFilters"]): boolean => {
  if (!urlFilters || urlFilters.length === 0) {
    return true;
  }

  const windowUrl = window.location.href;

  const isMatch = urlFilters.some((filter) => {
    const match = checkUrlMatch(windowUrl, filter.value, filter.rule);
    return match;
  });

  return isMatch;
};

export const evaluateNoCodeConfigClick = (targetElement: HTMLElement, action: TActionClass): boolean => {
  if (action.noCodeConfig?.type !== "click") return false;

  const innerHtml = action.noCodeConfig.elementSelector.innerHtml;
  const cssSelector = action.noCodeConfig.elementSelector.cssSelector;
  const urlFilters = action.noCodeConfig.urlFilters;

  if (!innerHtml && !cssSelector) return false;

  if (innerHtml && targetElement.innerHTML !== innerHtml) return false;

  if (cssSelector) {
    // Split selectors that start with a . or # including the . or #
    const individualSelectors = cssSelector.split(/\s*(?=[.#])/);
    for (let selector of individualSelectors) {
      if (!targetElement.matches(selector)) {
        return false;
      }
    }
  }

  const isValidUrl = handleUrlFilters(urlFilters);

  if (!isValidUrl) return false;

  return true;
};

export const handleHiddenFields = (
  hiddenFieldsConfig: TSurvey["hiddenFields"],
  hiddenFields: TJsTrackProperties["hiddenFields"]
): TResponseHiddenFieldValue => {
  const { enabled: enabledHiddenFields, fieldIds: hiddenFieldIds } = hiddenFieldsConfig || {};

  let hiddenFieldsObject: TResponseHiddenFieldValue = {};

  if (!enabledHiddenFields) {
    logger.error("Hidden fields are not enabled for this survey");
  } else if (hiddenFieldIds && hiddenFields) {
    const unknownHiddenFields: string[] = [];
    hiddenFieldsObject = Object.keys(hiddenFields).reduce((acc, key) => {
      if (hiddenFieldIds?.includes(key)) {
        acc[key] = hiddenFields?.[key];
      } else {
        unknownHiddenFields.push(key);
      }
      return acc;
    }, {} as TResponseHiddenFieldValue);

    if (unknownHiddenFields.length > 0) {
      logger.error(
        `Unknown hidden fields: ${unknownHiddenFields.join(", ")}. Please add them to the survey hidden fields.`
      );
    }
  }

  return hiddenFieldsObject;
};
export const getIsDebug = () => window.location.search.includes("formbricksDebug=true");

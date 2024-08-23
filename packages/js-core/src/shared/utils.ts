import {
  TActionClass,
  TActionClassNoCodeConfig,
  TActionClassPageUrlRule,
} from "@formbricks/types/action-classes";
import { TAttributes } from "@formbricks/types/attributes";
import { TJsTrackProperties } from "@formbricks/types/js";
import { TResponseHiddenFieldValue } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
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

export const shouldDisplayBasedOnPercentage = (displayPercentage: number) => {
  const randomNum = Math.floor(Math.random() * 10000) / 100;
  return randomNum <= displayPercentage;
};

export const getLanguageCode = (survey: TSurvey, attributes: TAttributes): string | undefined => {
  const language = attributes.language;
  const availableLanguageCodes = survey.languages.map((surveyLanguage) => surveyLanguage.language.code);
  if (!language) return "default";
  else {
    const selectedLanguage = survey.languages.find((surveyLanguage) => {
      return (
        surveyLanguage.language.code === language.toLowerCase() ||
        surveyLanguage.language.alias?.toLowerCase() === language.toLowerCase()
      );
    });
    if (selectedLanguage?.default) {
      return "default";
    }
    if (
      !selectedLanguage ||
      !selectedLanguage?.enabled ||
      !availableLanguageCodes.includes(selectedLanguage.language.code)
    ) {
      return undefined;
    }
    return selectedLanguage.language.code;
  }
};

export const getDefaultLanguageCode = (survey: TSurvey) => {
  const defaultSurveyLanguage = survey.languages?.find((surveyLanguage) => {
    return surveyLanguage.default === true;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};

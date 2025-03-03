import { diffInDays } from "@formbricks/lib/utils/datetime";
import {
  type TActionClassNoCodeConfig,
  type TActionClassPageUrlRule,
} from "@formbricks/types/action-classes";
import { type TAttributes } from "@formbricks/types/attributes";
import {
  type TJsEnvironmentState,
  type TJsEnvironmentStateActionClass,
  type TJsEnvironmentStateSurvey,
  type TJsPersonState,
  type TJsTrackProperties,
} from "@formbricks/types/js";
import { type TResponseHiddenFieldValue } from "@formbricks/types/responses";
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
  if (urlFilters.length === 0) {
    return true;
  }

  const windowUrl = window.location.href;

  const isMatch = urlFilters.some((filter) => {
    const match = checkUrlMatch(windowUrl, filter.value, filter.rule);
    return match;
  });

  return isMatch;
};

export const evaluateNoCodeConfigClick = (
  targetElement: HTMLElement,
  action: TJsEnvironmentStateActionClass
): boolean => {
  if (action.noCodeConfig?.type !== "click") return false;

  const innerHtml = action.noCodeConfig.elementSelector.innerHtml;
  const cssSelector = action.noCodeConfig.elementSelector.cssSelector;
  const urlFilters = action.noCodeConfig.urlFilters;

  if (!innerHtml && !cssSelector) return false;

  if (innerHtml && targetElement.innerHTML !== innerHtml) return false;

  if (cssSelector) {
    // Split selectors that start with a . or # including the . or #
    const individualSelectors = cssSelector.split(/\s*(?=[.#])/);
    for (const selector of individualSelectors) {
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
  hiddenFieldsConfig: TJsEnvironmentStateSurvey["hiddenFields"],
  hiddenFields: TJsTrackProperties["hiddenFields"]
): TResponseHiddenFieldValue => {
  const { enabled: enabledHiddenFields, fieldIds: hiddenFieldIds } = hiddenFieldsConfig;

  let hiddenFieldsObject: TResponseHiddenFieldValue = {};

  if (!enabledHiddenFields) {
    logger.error("Hidden fields are not enabled for this survey");
  } else if (hiddenFieldIds && hiddenFields) {
    const unknownHiddenFields: string[] = [];
    hiddenFieldsObject = Object.keys(hiddenFields).reduce<TResponseHiddenFieldValue>((acc, key) => {
      if (hiddenFieldIds.includes(key)) {
        acc[key] = hiddenFields[key];
      } else {
        unknownHiddenFields.push(key);
      }
      return acc;
    }, {});

    if (unknownHiddenFields.length > 0) {
      logger.error(
        `Unknown hidden fields: ${unknownHiddenFields.join(", ")}. Please add them to the survey hidden fields.`
      );
    }
  }

  return hiddenFieldsObject;
};

export const shouldDisplayBasedOnPercentage = (displayPercentage: number): boolean => {
  const randomNum = Math.floor(Math.random() * 10000) / 100;
  return randomNum <= displayPercentage;
};

export const getLanguageCode = (
  survey: TJsEnvironmentStateSurvey,
  attributes: TAttributes
): string | undefined => {
  const language = attributes.language;
  const availableLanguageCodes = survey.languages.map((surveyLanguage) => surveyLanguage.language.code);
  if (!language) return "default";

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
    !selectedLanguage.enabled ||
    !availableLanguageCodes.includes(selectedLanguage.language.code)
  ) {
    return undefined;
  }
  return selectedLanguage.language.code;
};

export const getDefaultLanguageCode = (survey: TJsEnvironmentStateSurvey): string | undefined => {
  const defaultSurveyLanguage = survey.languages.find((surveyLanguage) => {
    return surveyLanguage.default;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};

export const getIsDebug = (): boolean => window.location.search.includes("formbricksDebug=true");

/**
 * Filters surveys based on the displayOption, recontactDays, and segments
 * @param environmentSate -  The environment state
 * @param personState - The person state
 * @returns The filtered surveys
 */

// takes the environment and person state and returns the filtered surveys
export const filterSurveys = (
  environmentState: TJsEnvironmentState,
  personState: TJsPersonState
): TJsEnvironmentStateSurvey[] => {
  const { project, surveys } = environmentState.data;
  const { displays, responses, lastDisplayAt, segments, userId } = personState.data;

  // Function to filter surveys based on displayOption criteria
  let filteredSurveys = surveys.filter((survey: TJsEnvironmentStateSurvey) => {
    switch (survey.displayOption) {
      case "respondMultiple":
        return true;
      case "displayOnce":
        return displays.filter((display) => display.surveyId === survey.id).length === 0;
      case "displayMultiple":
        return responses.filter((surveyId) => surveyId === survey.id).length === 0;

      case "displaySome":
        if (survey.displayLimit === null) {
          return true;
        }

        // Check if survey response exists, if so, stop here
        if (responses.filter((surveyId) => surveyId === survey.id).length) {
          return false;
        }

        // Otherwise, check if displays length is less than displayLimit
        return displays.filter((display) => display.surveyId === survey.id).length < survey.displayLimit;

      default:
        throw Error("Invalid displayOption");
    }
  });

  // filter surveys that meet the recontactDays criteria
  filteredSurveys = filteredSurveys.filter((survey) => {
    // if no survey was displayed yet, show the survey
    if (!lastDisplayAt) {
      return true;
    }

    // if survey has recontactDays, check if the last display was more than recontactDays ago
    // The previous approach checked the last display for each survey which is why we still have a surveyId in the displays array.
    // TODO: Remove the surveyId from the displays array
    if (survey.recontactDays !== null) {
      return diffInDays(new Date(), new Date(lastDisplayAt)) >= survey.recontactDays;
    }

    // use recontactDays of the project if survey does not have recontactDays
    if (project.recontactDays) {
      return diffInDays(new Date(), new Date(lastDisplayAt)) >= project.recontactDays;
    }

    // if no recontactDays is set, show the survey

    return true;
  });

  if (!userId) {
    return filteredSurveys;
  }

  if (!segments.length) {
    return [];
  }

  // filter surveys based on segments
  return filteredSurveys.filter((survey) => {
    return survey.segment?.id && segments.includes(survey.segment.id);
  });
};

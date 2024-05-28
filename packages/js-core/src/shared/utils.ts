import { TAttributes } from "@formbricks/types/attributes";
import { TTrackProperties } from "@formbricks/types/js";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

export const getIsDebug = () => window.location.search.includes("formbricksDebug=true");

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

export const handleHiddenFields = (
  hiddenFieldsConfig: TSurvey["hiddenFields"],
  hiddenFields: TTrackProperties["hiddenFields"]
): TResponseData => {
  const { enabled: enabledHiddenFields, fieldIds: hiddenFieldIds } = hiddenFieldsConfig || {};

  let hiddenFieldsObject: TResponseData = {};

  if (!enabledHiddenFields) {
    console.warn("Hidden fields are not enabled for this survey");
  } else if (
    hiddenFieldIds &&
    hiddenFieldIds?.length > 0 &&
    hiddenFields &&
    Object.keys(hiddenFields).length > 0
  ) {
    const unknownHiddenFields: string[] = [];
    hiddenFieldsObject = Object.keys(hiddenFields).reduce((acc, key) => {
      if (hiddenFieldIds?.includes(key)) {
        acc[key] = hiddenFields?.[key];
      } else {
        unknownHiddenFields.push(key);
      }
      return acc;
    }, {} as TResponseData);

    if (unknownHiddenFields.length > 0) {
      console.warn(
        `Unknown hidden fields: ${unknownHiddenFields.join(", ")}. Please add them to the survey hidden fields.`
      );
    }
  }

  return hiddenFieldsObject;
};

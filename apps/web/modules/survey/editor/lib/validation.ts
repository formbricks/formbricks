// extend this object in order to add more validation rules
import { TFunction } from "i18next";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { TI18nString } from "@formbricks/types/i18n";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TInputFieldConfig,
  TSurveyAddressElement,
  TSurveyCTAElement,
  TSurveyConsentElement,
  TSurveyContactInfoElement,
  TSurveyElement,
  TSurveyMatrixElement,
  TSurveyMultipleChoiceElement,
  TSurveyOpenTextElement,
  TSurveyPictureSelectionElement,
} from "@formbricks/types/surveys/elements";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyLanguage,
  TSurveyRedirectUrlCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { findLanguageCodesForDuplicateLabels, getTextContent } from "@formbricks/types/surveys/validation";
import { extractLanguageCodes, getLocalizedValue } from "@/lib/i18n/utils";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";

// Utility function to check if label is valid for all required languages
export const isLabelValidForAllLanguages = (
  label: TI18nString,
  surveyLanguages: TSurveyLanguage[]
): boolean => {
  const filteredLanguages = surveyLanguages.filter((surveyLanguages) => {
    return surveyLanguages.enabled;
  });
  const languageCodes = extractLanguageCodes(filteredLanguages);
  const languages = languageCodes.length === 0 ? ["default"] : languageCodes;
  return languages.every((language) => label?.[language] && getTextContent(label[language]).length > 0);
};

// Validation logic for multiple choice elements
const handleI18nCheckForMultipleChoice = (
  element: TSurveyMultipleChoiceElement,
  languages: TSurveyLanguage[]
): boolean => {
  const invalidLangCodes = findLanguageCodesForDuplicateLabels(
    element.choices.map((choice) => choice.label),
    languages
  );

  if (invalidLangCodes.length > 0) {
    return false;
  }

  return element.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

const handleI18nCheckForMatrixLabels = (
  element: TSurveyMatrixElement,
  languages: TSurveyLanguage[]
): boolean => {
  const rowsAndColumns = [...element.rows, ...element.columns];

  const invalidRowsLangCodes = findLanguageCodesForDuplicateLabels(
    element.rows.map((row) => row.label),
    languages
  );
  const invalidColumnsLangCodes = findLanguageCodesForDuplicateLabels(
    element.columns.map((column) => column.label),
    languages
  );

  if (invalidRowsLangCodes.length > 0 || invalidColumnsLangCodes.length > 0) {
    return false;
  }

  return rowsAndColumns.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

const handleI18nCheckForContactAndAddressFields = (
  element: TSurveyContactInfoElement | TSurveyAddressElement,
  languages: TSurveyLanguage[]
): boolean => {
  let fields: TInputFieldConfig[] = [];
  if (element.type === "contactInfo") {
    const { firstName, lastName, phone, email, company } = element;
    fields = [firstName, lastName, phone, email, company];
  } else if (element.type === "address") {
    const { addressLine1, addressLine2, city, state, zip, country } = element;
    fields = [addressLine1, addressLine2, city, state, zip, country];
  }
  return fields.every((field) => {
    if (field.show) {
      return isLabelValidForAllLanguages(field.placeholder, languages);
    }
    return true;
  });
};

// Validation rules
export const validationRules = {
  openText: (element: TSurveyOpenTextElement, languages: TSurveyLanguage[]) => {
    return element.placeholder &&
      getLocalizedValue(element.placeholder, "default").trim() !== "" &&
      languages.length > 1
      ? isLabelValidForAllLanguages(element.placeholder, languages)
      : true;
  },
  multipleChoiceMulti: (element: TSurveyMultipleChoiceElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(element, languages);
  },
  multipleChoiceSingle: (element: TSurveyMultipleChoiceElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(element, languages);
  },
  consent: (element: TSurveyConsentElement, languages: TSurveyLanguage[]) => {
    return isLabelValidForAllLanguages(element.label, languages);
  },
  pictureSelection: (element: TSurveyPictureSelectionElement) => {
    return element.choices.length >= 2;
  },
  cta: (element: TSurveyCTAElement, languages: TSurveyLanguage[]) => {
    return element.buttonExternal && element.ctaButtonLabel
      ? isLabelValidForAllLanguages(element.ctaButtonLabel, languages)
      : true;
  },
  matrix: (element: TSurveyMatrixElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMatrixLabels(element, languages);
  },
  contactInfo: (element: TSurveyContactInfoElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForContactAndAddressFields(element, languages);
  },
  address: (element: TSurveyAddressElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForContactAndAddressFields(element, languages);
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (element: TSurveyElement, languages: TSurveyLanguage[]) => {
    // headline and subheader are default for every element
    const isHeadlineValid = isLabelValidForAllLanguages(element.headline, languages);
    const isSubheaderValid =
      element.subheader &&
      getLocalizedValue(element.subheader, "default").trim() !== "" &&
      languages.length > 1
        ? isLabelValidForAllLanguages(element.subheader, languages)
        : true;
    let isValid = isHeadlineValid && isSubheaderValid;
    const defaultLanguageCode = "default";
    // Element specific fields (note: buttonLabel and backButtonLabel are now block-level, not element-level)
    let fieldsToValidate = ["upperLabel", "lowerLabel"];

    for (const field of fieldsToValidate) {
      if (
        element[field] &&
        typeof element[field][defaultLanguageCode] !== "undefined" &&
        element[field][defaultLanguageCode].trim() !== ""
      ) {
        isValid = isValid && isLabelValidForAllLanguages(element[field], languages);
      }
    }

    return isValid;
  },
};

// Main validation function
export const validateElement = (element: TSurveyElement, surveyLanguages: TSurveyLanguage[]): boolean => {
  const specificValidation = validationRules[element.type];
  const defaultValidation = validationRules.defaultValidation;

  const specificValidationResult = specificValidation ? specificValidation(element, surveyLanguages) : true;
  const defaultValidationResult = defaultValidation(element, surveyLanguages);

  // Return true only if both specific and default validation pass
  return specificValidationResult && defaultValidationResult;
};

export const validateSurveyElementsInBatch = (
  element: TSurveyElement,
  invalidElements: string[] | null,
  surveyLanguages: TSurveyLanguage[]
) => {
  if (invalidElements === null) {
    return [];
  }

  if (validateElement(element, surveyLanguages)) {
    return invalidElements.filter((id) => id !== element.id);
  } else if (!invalidElements.includes(element.id)) {
    return [...invalidElements, element.id];
  }

  return invalidElements;
};

const isContentValid = (content: Record<string, string> | undefined, surveyLanguages: TSurveyLanguage[]) => {
  return !content || isLabelValidForAllLanguages(content, surveyLanguages);
};

export const isWelcomeCardValid = (card: TSurveyWelcomeCard, surveyLanguages: TSurveyLanguage[]): boolean => {
  return isContentValid(card.headline, surveyLanguages) && isContentValid(card.subheader, surveyLanguages);
};

export const isEndingCardValid = (
  card: TSurveyEndScreenCard | TSurveyRedirectUrlCard,
  surveyLanguages: TSurveyLanguage[]
) => {
  if (card.type === "endScreen") {
    const parseResult = z.string().url().safeParse(card.buttonLink);
    if (card.buttonLabel !== undefined && !parseResult.success) {
      return false;
    }

    return (
      isContentValid(card.headline, surveyLanguages) &&
      isContentValid(card.subheader, surveyLanguages) &&
      isContentValid(card.buttonLabel, surveyLanguages)
    );
  } else {
    const parseResult = z.string().url().safeParse(card.url);
    if (parseResult.success) {
      return card.label?.trim() !== "";
    } else {
      return false;
    }
  }
};

export const isSurveyValid = (
  survey: TSurvey,
  selectedLanguageCode: string,
  t: TFunction,
  responseCount?: number
) => {
  const questionWithEmptyFallback = checkForEmptyFallBackValue(survey, selectedLanguageCode);
  if (questionWithEmptyFallback) {
    toast.error(t("environments.surveys.edit.fallback_missing"));
    return false;
  }

  if (survey.type === "app" && survey.segment?.id === "temp") {
    const { filters } = survey.segment;

    const parsedFilters = ZSegmentFilters.safeParse(filters);
    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message ||
        t("environments.surveys.edit.invalid_targeting");
      toast.error(errMsg);
      return false;
    }
  }

  // Response limit validation
  if (survey.autoComplete !== null && responseCount !== undefined) {
    if (survey.autoComplete === 0) {
      toast.error(t("environments.surveys.edit.response_limit_can_t_be_set_to_0"));
      return false;
    }

    if (survey.autoComplete <= responseCount) {
      toast.error(
        t("environments.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses", {
          responseCount,
        }),
        {
          id: "response-limit-error",
        }
      );
      return false;
    }
  }

  return true;
};

// extend this object in order to add more validation rules
import { TFunction } from "i18next";
import { toast } from "react-hot-toast";
import { ZEndingCardUrl } from "@formbricks/types/common";
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
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";

const getDefaultText = (label?: TI18nString): string => {
  return getTextContent(label?.default ?? "");
};

export const isLabelValidForAllLanguages = (
  label: TI18nString,
  _surveyLanguages: TSurveyLanguage[]
): boolean => {
  return getDefaultText(label).trim().length > 0;
};

// Validation logic for multiple choice elements
const handleI18nCheckForMultipleChoice = (
  element: TSurveyMultipleChoiceElement,
  _languages: TSurveyLanguage[]
): boolean => {
  const normalizedLabels = element.choices
    .map((choice) => getDefaultText(choice.label).trim().toLowerCase())
    .filter(Boolean);
  const hasDuplicates = new Set(normalizedLabels).size !== normalizedLabels.length;
  return !hasDuplicates && element.choices.every((choice) => getDefaultText(choice.label).trim().length > 0);
};

const handleI18nCheckForMatrixLabels = (
  element: TSurveyMatrixElement,
  _languages: TSurveyLanguage[]
): boolean => {
  const rowsAndColumns = [...element.rows, ...element.columns];
  const rowLabels = element.rows.map((row) => getDefaultText(row.label).trim().toLowerCase()).filter(Boolean);
  const colLabels = element.columns
    .map((column) => getDefaultText(column.label).trim().toLowerCase())
    .filter(Boolean);

  const hasDuplicateRows = new Set(rowLabels).size !== rowLabels.length;
  const hasDuplicateColumns = new Set(colLabels).size !== colLabels.length;

  if (hasDuplicateRows || hasDuplicateColumns) {
    return false;
  }

  return rowsAndColumns.every((choice) => getDefaultText(choice.label).trim().length > 0);
};

const handleI18nCheckForContactAndAddressFields = (
  element: TSurveyContactInfoElement | TSurveyAddressElement,
  _languages: TSurveyLanguage[]
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
      return getDefaultText(field.placeholder).trim().length > 0;
    }
    return true;
  });
};

// Validation rules
export const validationRules = {
  openText: (element: TSurveyOpenTextElement, _languages: TSurveyLanguage[]) => {
    return element.placeholder &&
      getLocalizedValue(element.placeholder, "default").trim() !== "" &&
      getLocalizedValue(element.placeholder, "default").trim() !== ""
      ? getDefaultText(element.placeholder).trim().length > 0
      : true;
  },
  multipleChoiceMulti: (element: TSurveyMultipleChoiceElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(element, languages);
  },
  multipleChoiceSingle: (element: TSurveyMultipleChoiceElement, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(element, languages);
  },
  consent: (element: TSurveyConsentElement, _languages: TSurveyLanguage[]) => {
    return getDefaultText(element.label).trim().length > 0;
  },
  pictureSelection: (element: TSurveyPictureSelectionElement) => {
    return element.choices.length >= 2;
  },
  cta: (element: TSurveyCTAElement, _languages: TSurveyLanguage[]) => {
    return element.buttonExternal && element.ctaButtonLabel
      ? getDefaultText(element.ctaButtonLabel).trim().length > 0
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
  defaultValidation: (element: TSurveyElement, _languages: TSurveyLanguage[]) => {
    // headline and subheader are default for every element
    const isHeadlineValid = getDefaultText(element.headline).trim().length > 0;
    const isSubheaderValid =
      element.subheader &&
      getLocalizedValue(element.subheader, "default").trim() !== "" &&
      getLocalizedValue(element.subheader, "default").trim() !== ""
        ? getDefaultText(element.subheader).trim().length > 0
        : true;
    let isValid = isHeadlineValid && isSubheaderValid;
    const defaultLanguageCode = "default";
    // Element specific fields (note: buttonLabel and backButtonLabel are now block-level, not element-level)
    let fieldsToValidate = ["upperLabel", "lowerLabel"];

    for (const field of fieldsToValidate) {
      const fieldValue = (element as unknown as Record<string, Record<string, string> | undefined>)[field];
      if (fieldValue?.[defaultLanguageCode] !== undefined && fieldValue[defaultLanguageCode].trim() !== "") {
        isValid = isValid && getDefaultText(fieldValue).trim().length > 0;
      }
    }

    return isValid;
  },
};

// Main validation function
export const validateElement = (element: TSurveyElement, surveyLanguages: TSurveyLanguage[]): boolean => {
  const specificValidation = (
    validationRules as Record<
      string,
      ((element: TSurveyElement, languages: TSurveyLanguage[]) => boolean) | undefined
    >
  )[element.type];
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

const isContentValid = (content: Record<string, string> | undefined, _surveyLanguages: TSurveyLanguage[]) => {
  return !content || getDefaultText(content).trim().length > 0;
};

const hasValidSurveyClosedMessageHeading = (survey: TSurvey): boolean => {
  if (survey.type !== "link" || !survey.surveyClosedMessage) {
    return true;
  }

  const heading = survey.surveyClosedMessage.heading?.trim() ?? "";

  return heading.length > 0;
};

export const isWelcomeCardValid = (card: TSurveyWelcomeCard, surveyLanguages: TSurveyLanguage[]): boolean => {
  return isContentValid(card.headline, surveyLanguages) && isContentValid(card.subheader, surveyLanguages);
};

export const isEndingCardValid = (
  card: TSurveyEndScreenCard | TSurveyRedirectUrlCard,
  surveyLanguages: TSurveyLanguage[]
) => {
  if (card.type === "endScreen") {
    // Use ZEndingCardUrl for consistent validation - allows dynamic URLs via hidden fields/recall values
    if (card.buttonLabel !== undefined) {
      if (!card.buttonLink) {
        return false;
      }
      const parseResult = ZEndingCardUrl.safeParse(card.buttonLink.trim());
      if (!parseResult.success) {
        return false;
      }
    }

    return (
      isContentValid(card.headline, surveyLanguages) &&
      isContentValid(card.subheader, surveyLanguages) &&
      isContentValid(card.buttonLabel, surveyLanguages)
    );
  } else {
    // Use ZEndingCardUrl for consistent validation - allows dynamic URLs via hidden fields/recall values
    if (!card.url || card.url.trim() === "") {
      return false;
    }
    const parseResult = ZEndingCardUrl.safeParse(card.url.trim());
    if (!parseResult.success) {
      return false;
    }
    return card.label?.trim() !== "";
  }
};

export const isSurveyValid = (survey: TSurvey, t: TFunction, responseCount?: number) => {
  const questionWithEmptyFallback = checkForEmptyFallBackValue(survey, "default");
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

  if (!hasValidSurveyClosedMessageHeading(survey)) {
    toast.error(t("environments.surveys.edit.survey_closed_message_heading_required"));
    return false;
  }

  return true;
};

// extend this object in order to add more validation rules
import { TFunction } from "i18next";
import { toast } from "react-hot-toast";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { ZEndingCardUrl } from "@formbricks/types/common";
import { TI18nString } from "@formbricks/types/i18n";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { TSurveyBlockLogic, ZSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
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
import {
  TValidateIdError,
  TValidateIdErrorCode,
  findLanguageCodesForDuplicateLabels,
  getTextContent,
} from "@formbricks/types/surveys/validation";
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
      const fieldValue = (element as unknown as Record<string, Record<string, string> | undefined>)[field];
      if (fieldValue?.[defaultLanguageCode] !== undefined && fieldValue[defaultLanguageCode].trim() !== "") {
        isValid = isValid && isLabelValidForAllLanguages(fieldValue, languages);
      }
    }

    return isValid;
  },
};

// Validate a single conditional-logic rule against its schema (catches e.g. a
// missing right operand or empty jump target).
export const isBlockLogicItemValid = (logicItem: TSurveyBlockLogic): boolean =>
  ZSurveyBlockLogic.safeParse(logicItem).success;

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

const isContentValid = (content: Record<string, string> | undefined, surveyLanguages: TSurveyLanguage[]) => {
  return !content || isLabelValidForAllLanguages(content, surveyLanguages);
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

export const isSurveyValid = (
  survey: TSurvey,
  selectedLanguageCode: string,
  t: TFunction,
  /**
   * Completed responses only — `survey.autoComplete` is a limit on completions, so partial
   * starts must not count towards it.
   */
  finishedResponseCount?: number
) => {
  const questionWithEmptyFallback = checkForEmptyFallBackValue(survey, selectedLanguageCode);
  if (questionWithEmptyFallback) {
    toast.error(t("workspace.surveys.edit.fallback_missing"));
    return false;
  }

  if (survey.type === "app" && survey.segment?.id === "temp") {
    const { filters } = survey.segment;

    const parsedFilters = ZSegmentFilters.safeParse(filters);
    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message ||
        t("workspace.surveys.edit.invalid_targeting");
      toast.error(errMsg);
      return false;
    }
  }

  // Response limit validation
  if (survey.autoComplete !== null && finishedResponseCount !== undefined) {
    if (survey.autoComplete === 0) {
      toast.error(t("workspace.surveys.edit.response_limit_can_t_be_set_to_0"));
      return false;
    }

    if (survey.autoComplete <= finishedResponseCount) {
      toast.error(
        t("workspace.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses", {
          responseCount: finishedResponseCount,
        }),
        {
          id: "response-limit-error",
        }
      );
      return false;
    }
  }

  if (!hasValidSurveyClosedMessageHeading(survey)) {
    toast.error(t("workspace.surveys.edit.survey_closed_message_heading_required"));
    return false;
  }

  return true;
};

// Element fields holding a TI18nString: in an issue path the segment right after them is a language code.
const I18N_STRING_FIELDS = new Set([
  "headline",
  "subheader",
  "html",
  "label",
  "placeholder",
  "upperLabel",
  "lowerLabel",
  "buttonLabel",
  "backButtonLabel",
  "dismissButtonLabel",
  "ctaButtonLabel",
]);

// Collections inside an element whose entries are numbered in the editor UI.
const NUMBERED_COLLECTION_LABEL_KEYS: Record<string, string> = {
  rows: "common.row_n",
  columns: "common.column_n",
  choices: "common.choice_n",
};

// Every message Zod generates itself starts with this — "Invalid input" for a union, "Invalid input:
// expected string, received undefined" for a type mismatch. A message a schema authored does not.
const ZOD_DEFAULT_MESSAGE_PREFIX = "Invalid input";

interface TElementIssueDescription {
  message: string;
  /** Set when the issue points at a single language of a translated field, so the caller can open the Language tab. */
  languageCode?: string;
}

/**
 * Locates a Zod issue for the survey author: names the block and the question it belongs to, and — when
 * the issue carries no message of its own — the field it points at.
 *
 * Zod's own defaults name nothing, so an element that fails validation leaves an author with a red card
 * and no idea which field to fix. The issue path does carry that (e.g.
 * `blocks.0.elements.0.rows.1.label.de`), so the message is built from it instead. A message the schema
 * authored ("Cal user name is required") is kept as-is and only gets its location prepended.
 *
 * Returns null for paths outside an element; those keep their own message.
 */
export const describeElementIssue = (
  issue: { path: PropertyKey[]; message: string },
  t: TFunction,
  locale: string
): TElementIssueDescription | null => {
  const [root, blockIndex, elementsKey, elementIndex, ...fieldPath] = issue.path;

  if (
    root !== "blocks" ||
    elementsKey !== "elements" ||
    typeof blockIndex !== "number" ||
    typeof elementIndex !== "number"
  ) {
    return null;
  }

  const blockNumber = blockIndex + 1;
  const questionNumber = elementIndex + 1;

  if (!issue.message.startsWith(ZOD_DEFAULT_MESSAGE_PREFIX)) {
    return {
      message: t("workspace.surveys.edit.issue_in_question", {
        message: issue.message,
        questionNumber,
        blockNumber,
      }),
    };
  }

  let languageCode: string | undefined;
  const fieldParts: string[] = [];

  fieldPath.forEach((segment, index) => {
    if (typeof segment === "number") {
      const collectionKey = NUMBERED_COLLECTION_LABEL_KEYS[String(fieldPath[index - 1])];
      // Numbered entry of a known collection: replace the raw "rows"/"1" pair with "Row 2".
      if (collectionKey) {
        fieldParts.pop();
        fieldParts.push(t(collectionKey, { n: segment + 1 }));
      } else {
        fieldParts.push(String(segment + 1));
      }
      return;
    }

    if (typeof segment === "string") {
      // The segment after a translated field is a language code, not a field of its own.
      if (index > 0 && I18N_STRING_FIELDS.has(String(fieldPath[index - 1]))) {
        languageCode = segment;
        return;
      }
      fieldParts.push(segment);
    }
  });

  if (!fieldParts.length) {
    return {
      message: t("workspace.surveys.edit.invalid_question_in_block", { questionNumber, blockNumber }),
    };
  }

  const field = fieldParts.join(" ");

  if (languageCode) {
    return {
      languageCode,
      message: t("workspace.surveys.edit.invalid_field_in_question_for_languages", {
        field,
        questionNumber,
        blockNumber,
        languages: getLanguageLabel(languageCode, locale) ?? languageCode,
      }),
    };
  }

  return {
    message: t("workspace.surveys.edit.invalid_field_in_question", { field, questionNumber, blockNumber }),
  };
};

export const getValidateIdErrorMessage = (
  error: TValidateIdError,
  type: "hiddenField" | "question",
  t: TFunction
): string => {
  const localizedType =
    type === "hiddenField" ? t("common.hidden_field") : t("workspace.surveys.edit.question");

  switch (error.code) {
    case TValidateIdErrorCode.Empty:
      return t("workspace.surveys.edit.validate_id_empty", { type: localizedType });
    case TValidateIdErrorCode.Duplicate:
      return t("workspace.surveys.edit.validate_id_duplicate", { type: localizedType });
    case TValidateIdErrorCode.Reserved:
      return t("workspace.surveys.edit.validate_id_reserved", { type: localizedType, field: error.field });
    case TValidateIdErrorCode.HasSpaces:
      return t("workspace.surveys.edit.validate_id_no_spaces", { type: localizedType });
    case TValidateIdErrorCode.InvalidChars:
      return t("workspace.surveys.edit.validate_id_invalid_chars", { type: localizedType });
    default:
      return t("workspace.surveys.edit.validate_id_invalid_chars", { type: localizedType });
  }
};

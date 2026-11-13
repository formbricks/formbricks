// extend this object in order to add more validation rules
import { TFunction } from "i18next";
import { z } from "zod";
import { ZEndingCardButtonLink, ZEndingCardUrl } from "@formbricks/types/common";
import { TI18nString } from "@formbricks/types/i18n";
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
  TSurveyStatus,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import {
  TValidateIdError,
  TValidateIdErrorCode,
  findLanguageCodesForDuplicateLabels,
  getTextContent,
} from "@formbricks/types/surveys/validation";
import { extractLanguageCodes, getLocalizedValue } from "@/lib/i18n/utils";
import { isAppSurveyMissingTriggersToPublish } from "@/lib/survey/publish-rule";

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

// An optional field left empty in the default language (e.g. the alt text of a decorative image) needs no
// translations; once the default has text, every enabled language needs it too.
const isOptionalLabelValid = (label: TI18nString | undefined, surveyLanguages: TSurveyLanguage[]): boolean =>
  !label?.default?.trim() || isLabelValidForAllLanguages(label, surveyLanguages);

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
  pictureSelection: (element: TSurveyPictureSelectionElement, languages: TSurveyLanguage[]) => {
    return (
      element.choices.length >= 2 &&
      element.choices.every((choice) => isOptionalLabelValid(choice.imageAltText, languages))
    );
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
    let fieldsToValidate = ["upperLabel", "lowerLabel", "imageAltText"];

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

export const hasValidSurveyClosedMessageHeading = (survey: TSurvey): boolean => {
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
      const parseResult = ZEndingCardButtonLink.safeParse(card.buttonLink.trim());
      if (!parseResult.success) {
        return false;
      }
    }

    return (
      isContentValid(card.headline, surveyLanguages) &&
      isContentValid(card.subheader, surveyLanguages) &&
      isContentValid(card.buttonLabel, surveyLanguages) &&
      isOptionalLabelValid(card.imageAltText, surveyLanguages)
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

/**
 * Whether saving `survey` at `targetStatus` would leave an app survey live with nothing that can ever
 * display it: the server's own publish rule, run before the save so the editor never promises one the
 * server refuses.
 *
 * `targetStatus` is the status the survey is heading for, not the one it has: publishing a draft
 * ("inProgress") and scheduling one ("paused") both need a trigger or a creative that opens it, while
 * saving it as a draft does not.
 */
export const isMissingRequiredTrigger = (
  survey: TSurvey,
  targetStatus: TSurveyStatus,
  isOpenedByCreative: boolean
): boolean =>
  isAppSurveyMissingTriggersToPublish({
    type: survey.type,
    status: targetStatus,
    triggers: survey.triggers,
    isOpenedByCreative,
  });

// Element fields whose schema name is not what the author sees in the editor. A function with literal
// t() calls rather than a key table, because the translation scanner only sees literal keys.
export const getElementFieldLabel = (field: string, t: TFunction): string | undefined => {
  if (field === "shuffleOption") return t("workspace.surveys.edit.field_label_shuffle_option");
  if (field === "imageAltText") return t("workspace.surveys.edit.image_alt_text");
  return undefined;
};

/**
 * A Zod issue as this module reads it. Beyond the path and the message it keeps the fields Zod's own
 * locale map renders from, because `isZodGeneratedMessage` replays that map to tell a generated
 * message from an authored one. Pass a whole issue, not a subset — a stripped one reads as authored.
 */
export interface TDescribableIssue {
  path: PropertyKey[];
  message: string;
  code?: string;
  expected?: string;
  values?: unknown[];
  errors?: unknown[];
  origin?: string;
  minimum?: unknown;
  maximum?: unknown;
  inclusive?: boolean;
  format?: string;
  pattern?: string;
  prefix?: string;
  suffix?: string;
  includes?: string;
  divisor?: number;
  keys?: string[];
  algorithm?: string;
}

// Zod always builds its own messages from the English locale map, whatever the app language is.
const zodEnLocale = z.core.locales.en();

// `received` is derived from the input, which a finalized issue no longer carries, so the
// reconstruction below ends at "expected string," where the real message says ", received number".
const stripReceived = (message: string): string => message.split(", received ")[0];

/**
 * Whether Zod wrote this message itself, rather than a schema authoring one.
 *
 * Sniffing the wording does not survive Zod's own phrasing: a bad enum reads "Invalid option: expected
 * one of …", a bad union "Invalid input", a bad type "Invalid input: expected string, received number".
 * So ask Zod instead — rebuild what its locale map would have said for this issue and compare. A schema
 * that authored a message ("Cal user name is required") does not match its own default.
 *
 * An issue shape the locale map cannot render counts as authored, so its message still reaches the
 * author; the caller prepends the location either way.
 */
export const isZodGeneratedMessage = (issue: TDescribableIssue): boolean => {
  try {
    // A finalized issue carries every field the locale map reads; only its `input` is stripped.
    const zodDefault = zodEnLocale.localeError(issue as unknown as z.core.$ZodRawIssue);
    const defaultMessage = typeof zodDefault === "string" ? zodDefault : zodDefault?.message;

    if (!defaultMessage) return false;

    return stripReceived(defaultMessage) === stripReceived(issue.message);
  } catch {
    return false;
  }
};

// "shuffleOption" -> "shuffle option". Schema field names are camelCase; authors do not read camelCase.
export const humanizeFieldName = (field: string): string =>
  field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/**
 * Why an element id the author typed cannot be used.
 *
 * Question ids are the only thing left that reaches these strings. They used to be shared with the
 * hidden-fields and variables cards through a `{type}` placeholder, which is why every sentence read
 * "{Hidden field,Variable} ID …" — vocabulary the merged Embedded Data card removed. That card
 * phrases its own refusals now (`getEmbeddedFieldErrorMessage`), naming whichever of Name or Key the
 * author is looking at, so the placeholder had one value left and the sentences say it outright.
 */
export const getValidateIdErrorMessage = (error: TValidateIdError, t: TFunction): string => {
  switch (error.code) {
    case TValidateIdErrorCode.Empty:
      return t("workspace.surveys.edit.validate_id_empty");
    case TValidateIdErrorCode.Duplicate:
      return t("workspace.surveys.edit.validate_id_duplicate");
    case TValidateIdErrorCode.Reserved:
      return t("workspace.surveys.edit.validate_id_reserved", { field: error.field });
    case TValidateIdErrorCode.HasSpaces:
      return t("workspace.surveys.edit.validate_id_no_spaces");
    case TValidateIdErrorCode.InvalidChars:
      return t("workspace.surveys.edit.validate_id_invalid_chars");
    case TValidateIdErrorCode.NotSafeIdentifier:
      return t("workspace.surveys.edit.validate_id_not_safe_identifier");
  }
};

// extend this object in order to add more validation rules
import { toast } from "react-hot-toast";
import { z } from "zod";
import { extractLanguageCodes, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { checkForEmptyFallBackValue } from "@formbricks/lib/utils/recall";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TI18nString,
  TSurvey,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyEndScreenCard,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
  TSurveyRedirectUrlCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { findLanguageCodesForDuplicateLabels } from "@formbricks/types/surveys/validation";

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
  return languages.every((language) => label && label[language] && label[language].trim() !== "");
};

// Validation logic for multiple choice questions
const handleI18nCheckForMultipleChoice = (
  question: TSurveyMultipleChoiceQuestion,
  languages: TSurveyLanguage[]
): boolean => {
  const invalidLangCodes = findLanguageCodesForDuplicateLabels(
    question.choices.map((choice) => choice.label),
    languages
  );

  if (invalidLangCodes.length > 0) {
    return false;
  }

  return question.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

const handleI18nCheckForMatrixLabels = (
  question: TSurveyMatrixQuestion,
  languages: TSurveyLanguage[]
): boolean => {
  const rowsAndColumns = [...question.rows, ...question.columns];

  const invalidRowsLangCodes = findLanguageCodesForDuplicateLabels(question.rows, languages);
  const invalidColumnsLangCodes = findLanguageCodesForDuplicateLabels(question.columns, languages);

  if (invalidRowsLangCodes.length > 0 || invalidColumnsLangCodes.length > 0) {
    return false;
  }

  return rowsAndColumns.every((label) => isLabelValidForAllLanguages(label, languages));
};

// Validation rules
export const validationRules = {
  openText: (question: TSurveyOpenTextQuestion, languages: TSurveyLanguage[]) => {
    return question.placeholder &&
      getLocalizedValue(question.placeholder, "default").trim() !== "" &&
      languages.length > 1
      ? isLabelValidForAllLanguages(question.placeholder, languages)
      : true;
  },
  multipleChoiceMulti: (question: TSurveyMultipleChoiceQuestion, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  multipleChoiceSingle: (question: TSurveyMultipleChoiceQuestion, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  consent: (question: TSurveyConsentQuestion, languages: TSurveyLanguage[]) => {
    return isLabelValidForAllLanguages(question.label, languages);
  },
  pictureSelection: (question: TSurveyPictureSelectionQuestion) => {
    return question.choices.length >= 2;
  },
  cta: (question: TSurveyCTAQuestion, languages: TSurveyLanguage[]) => {
    return !question.required && question.dismissButtonLabel
      ? isLabelValidForAllLanguages(question.dismissButtonLabel, languages)
      : true;
  },
  matrix: (question: TSurveyMatrixQuestion, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMatrixLabels(question, languages);
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (question: TSurveyQuestion, languages: TSurveyLanguage[], isFirstQuestion: boolean) => {
    // headline and subheader are default for every question
    const isHeadlineValid = isLabelValidForAllLanguages(question.headline, languages);
    const isSubheaderValid =
      question.subheader &&
      getLocalizedValue(question.subheader, "default").trim() !== "" &&
      languages.length > 1
        ? isLabelValidForAllLanguages(question.subheader, languages)
        : true;
    let isValid = isHeadlineValid && isSubheaderValid;
    const defaultLanguageCode = "default";
    //question specific fields
    let fieldsToValidate = ["html", "buttonLabel", "upperLabel", "backButtonLabel", "lowerLabel"];

    // Remove backButtonLabel from validation if it is the first question
    if (isFirstQuestion) {
      fieldsToValidate = fieldsToValidate.filter((field) => field !== "backButtonLabel");
    }

    for (const field of fieldsToValidate) {
      if (
        question[field] &&
        typeof question[field][defaultLanguageCode] !== "undefined" &&
        question[field][defaultLanguageCode].trim() !== ""
      ) {
        isValid = isValid && isLabelValidForAllLanguages(question[field], languages);
      }
    }

    return isValid;
  },
};

// Main validation function
export const validateQuestion = (
  question: TSurveyQuestion,
  surveyLanguages: TSurveyLanguage[],
  isFirstQuestion: boolean
): boolean => {
  const specificValidation = validationRules[question.type];
  const defaultValidation = validationRules.defaultValidation;

  const specificValidationResult = specificValidation ? specificValidation(question, surveyLanguages) : true;
  const defaultValidationResult = defaultValidation(question, surveyLanguages, isFirstQuestion);

  // Return true only if both specific and default validation pass
  return specificValidationResult && defaultValidationResult;
};

export const validateSurveyQuestionsInBatch = (
  question: TSurveyQuestion,
  invalidQuestions: string[] | null,
  surveyLanguages: TSurveyLanguage[],
  isFirstQuestion: boolean
) => {
  if (invalidQuestions === null) {
    return [];
  }

  if (validateQuestion(question, surveyLanguages, isFirstQuestion)) {
    return invalidQuestions.filter((id) => id !== question.id);
  } else if (!invalidQuestions.includes(question.id)) {
    return [...invalidQuestions, question.id];
  }

  return invalidQuestions;
};

const isContentValid = (content: Record<string, string> | undefined, surveyLanguages: TSurveyLanguage[]) => {
  return !content || isLabelValidForAllLanguages(content, surveyLanguages);
};

export const isWelcomeCardValid = (card: TSurveyWelcomeCard, surveyLanguages: TSurveyLanguage[]): boolean => {
  return isContentValid(card.headline, surveyLanguages) && isContentValid(card.html, surveyLanguages);
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

export const isSurveyValid = (survey: TSurvey, selectedLanguageCode: string) => {
  const questionWithEmptyFallback = checkForEmptyFallBackValue(survey, selectedLanguageCode);
  if (questionWithEmptyFallback) {
    toast.error("Fallback missing");
    return false;
  }

  if (survey.type === "app" && survey.segment?.id === "temp") {
    const { filters } = survey.segment;

    const parsedFilters = ZSegmentFilters.safeParse(filters);
    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message ||
        "Invalid targeting: Please check your audience filters";
      toast.error(errMsg);
      return;
    }
  }

  return true;
};

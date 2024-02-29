// extend this object in order to add more validation rules
import { extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyLanguage,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

// Utility function to check if label is valid for all required languages
const isLabelValidForAllLanguages = (
  label: string | TI18nString,
  surveyLanguages: TSurveyLanguage[]
): boolean => {
  const languages = extractLanguageCodes(surveyLanguages);
  if (typeof label === "string") {
    return label.trim() !== "";
  } else {
    return languages.every((language) => label && label[language] && label[language].trim() !== "");
  }
};

// Validation logic for multiple choice questions
const handleI18nCheckForMultipleChoice = (
  question: TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion,
  languages: TSurveyLanguage[]
): boolean => {
  return question.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

// Validation rules
const validationRules = {
  multipleChoiceMulti: (question: TSurveyMultipleChoiceMultiQuestion, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  multipleChoiceSingle: (question: TSurveyMultipleChoiceSingleQuestion, languages: TSurveyLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  consent: (question: TSurveyConsentQuestion, languages: TSurveyLanguage[]) => {
    return isLabelValidForAllLanguages(question.label, languages);
  },
  pictureSelection: (question: TSurveyPictureSelectionQuestion) => {
    return question.choices.length >= 2;
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (question: TSurveyQuestion, languages: TSurveyLanguage[]) => {
    let isValid = isLabelValidForAllLanguages(question.headline, languages);
    let isValidCTADismissLabel = true;
    const defaultLanguageCode = "default";
    if (question.type === "cta" && !question.required) {
      isValidCTADismissLabel = isLabelValidForAllLanguages(
        (question as TSurveyCTAQuestion).dismissButtonLabel ?? "",
        languages
      );
    }
    const fieldsToValidate = [
      "subheader",
      "html",
      "buttonLabel",
      "upperLabel",
      "backButtonLabel",
      "lowerLabel",
      "placeholder",
    ];

    for (const field of fieldsToValidate) {
      if (question[field] && question[field][defaultLanguageCode]) {
        isValid =
          isValid && isLabelValidForAllLanguages(question[field], languages) && isValidCTADismissLabel;
      }
    }

    return isValid;
  },
};

// Main validation function
const validateQuestion = (question: TSurveyQuestion, surveyLanguages: TSurveyLanguage[]): boolean => {
  const specificValidation = validationRules[question.type];
  const defaultValidation = validationRules.defaultValidation;

  const specificValidationResult = specificValidation ? specificValidation(question, surveyLanguages) : true;
  const defaultValidationResult = defaultValidation(question, surveyLanguages);

  // Return true only if both specific and default validation pass
  return specificValidationResult && defaultValidationResult;
};

export { validateQuestion, isLabelValidForAllLanguages };

export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch (e) {
    return false;
  }
};

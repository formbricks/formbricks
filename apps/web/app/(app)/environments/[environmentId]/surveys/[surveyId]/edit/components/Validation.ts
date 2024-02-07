// extend this object in order to add more validation rules
import { extractLanguageIds, getDefaultLanguage } from "@formbricks/lib/i18n/utils";
import { TLanguage } from "@formbricks/types/product";
import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

// Utility function to check if label is valid for all required languages
const isLabelValidForAllLanguages = (label: string | TI18nString, surveyLanguages: TLanguage[]): boolean => {
  const languages = extractLanguageIds(surveyLanguages);
  if (typeof label === "string") {
    return label.trim() !== "";
  } else {
    return languages.every((language) => label[language] && label[language].trim() !== "");
  }
};

// Validation logic for multiple choice questions
const handleI18nCheckForMultipleChoice = (
  question: TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion,
  languages: TLanguage[]
): boolean => {
  return question.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

// Validation rules
const validationRules = {
  multipleChoiceMulti: (question: TSurveyMultipleChoiceMultiQuestion, languages: TLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  multipleChoiceSingle: (question: TSurveyMultipleChoiceSingleQuestion, languages: TLanguage[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  consent: (question: TSurveyConsentQuestion, languages: TLanguage[]) => {
    return isLabelValidForAllLanguages(question.label, languages);
  },
  pictureSelection: (question: TSurveyPictureSelectionQuestion) => {
    return question.choices.length >= 2;
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (question: TSurveyQuestion, languages: TLanguage[]) => {
    let isValid = isLabelValidForAllLanguages(question.headline, languages);
    let isValidCTADismissLabel = true;
    const defaultLanguageSymbol = getDefaultLanguage(languages).id;
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
      if (question[field] && question[field][defaultLanguageSymbol]) {
        isValid =
          isValid && isLabelValidForAllLanguages(question[field], languages) && isValidCTADismissLabel;
      }
    }

    return isValid;
  },
};

// Main validation function
const validateQuestion = (question: TSurveyQuestion, surveyLanguages: TLanguage[]): boolean => {
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

import {
  TI18nString,
  TSurveyConsentQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
} from "@formbricks/types/surveys";

// Utility function to check if label is valid for all required languages
const isLabelValidForAllLanguages = (label: string | TI18nString, languages: string[]): boolean => {
  if (typeof label === "string") {
    return label.trim() !== "";
  } else {
    return languages.every((language) => label[language] && label[language].trim() !== "");
  }
};

// Validation logic for multiple choice questions
const handleI18nCheckForMultipleChoice = (
  question: TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceSingleQuestion,
  languages: string[]
): boolean => {
  return question.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));
};

// Validation rules
const validationRules = {
  multipleChoiceMulti: (question: TSurveyMultipleChoiceMultiQuestion, languages: string[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  multipleChoiceSingle: (question: TSurveyMultipleChoiceSingleQuestion, languages: string[]) => {
    return handleI18nCheckForMultipleChoice(question, languages);
  },
  consent: (question: TSurveyConsentQuestion, languages: string[]) => {
    return isLabelValidForAllLanguages(question.label, languages);
  },
  pictureSelection: (question: TSurveyPictureSelectionQuestion) => {
    return question.choices.length >= 2;
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (question: TSurveyQuestion, languages: string[]) => {
    return isLabelValidForAllLanguages(question.headline, languages);
  },
};

// Main validation function
const validateQuestion = (question: TSurveyQuestion, languages: string[]): boolean => {
  const specificValidation = validationRules[question.type];
  const defaultValidation = validationRules.defaultValidation;

  const specificValidationResult = specificValidation ? specificValidation(question, languages) : true;
  const defaultValidationResult = defaultValidation(question, languages);

  // Return true only if both specific and default validation pass
  return specificValidationResult && defaultValidationResult;
};

export { validateQuestion, isLabelValidForAllLanguages };

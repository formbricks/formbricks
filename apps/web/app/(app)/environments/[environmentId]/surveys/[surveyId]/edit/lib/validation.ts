// extend this object in order to add more validation rules
import { extractLanguageCodes, getLocalizedValue } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyLanguage,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";

// Utility function to check if label is valid for all required languages
const isLabelValidForAllLanguages = (label: TI18nString, surveyLanguages: TSurveyLanguage[]): boolean => {
  const filteredLanguages = surveyLanguages.filter((surveyLanguages) => {
    return surveyLanguages.enabled;
  });
  const languageCodes = extractLanguageCodes(filteredLanguages);
  const languages = languageCodes.length === 0 ? ["default"] : languageCodes;
  return languages.every((language) => label && label[language] && label[language].trim() !== "");
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
  openText: (question: TSurveyOpenTextQuestion, languages: TSurveyLanguage[]) => {
    return question.placeholder &&
      getLocalizedValue(question.placeholder, "default").trim() !== "" &&
      languages.length > 1
      ? isLabelValidForAllLanguages(question.placeholder, languages)
      : true;
  },
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
  cta: (question: TSurveyCTAQuestion, languages: TSurveyLanguage[]) => {
    return !question.required && question.dismissButtonLabel
      ? isLabelValidForAllLanguages(question.dismissButtonLabel, languages)
      : true;
  },
  // Assuming headline is of type TI18nString
  defaultValidation: (question: TSurveyQuestion, languages: TSurveyLanguage[]) => {
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
    const fieldsToValidate = ["html", "buttonLabel", "upperLabel", "backButtonLabel", "lowerLabel"];

    for (const field of fieldsToValidate) {
      if (question[field] && typeof question[field][defaultLanguageCode] !== "undefined") {
        isValid = isValid && isLabelValidForAllLanguages(question[field], languages);
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

export const validateSurveyQuestionsInBatch = (
  question: TSurveyQuestion,
  invalidQuestions: string[] | null,
  surveyLanguages: TSurveyLanguage[]
) => {
  if (invalidQuestions === null) {
    return [];
  }

  if (validateQuestion(question, surveyLanguages)) {
    return invalidQuestions.filter((id) => id !== question.id);
  } else if (!invalidQuestions.includes(question.id)) {
    return [...invalidQuestions, question.id];
  }

  return invalidQuestions;
};

export const isCardValid = (
  card: TSurveyWelcomeCard | TSurveyThankYouCard,
  cardType: "start" | "end",
  surveyLanguages: TSurveyLanguage[]
): boolean => {
  const defaultLanguageCode = "default";
  const isContentValid = (content: Record<string, string> | undefined) => {
    return (
      !content || content[defaultLanguageCode] === "" || isLabelValidForAllLanguages(content, surveyLanguages)
    );
  };

  return (
    (card.headline ? isLabelValidForAllLanguages(card.headline, surveyLanguages) : true) &&
    isContentValid(
      cardType === "start" ? (card as TSurveyWelcomeCard).html : (card as TSurveyThankYouCard).subheader
    ) &&
    isContentValid(card.buttonLabel)
  );
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

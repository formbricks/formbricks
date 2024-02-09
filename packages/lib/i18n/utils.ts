import { TLanguage, TProduct } from "@formbricks/types/product";
import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyRatingQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";
import { TSurvey, TSurveyMultipleChoiceMultiQuestion, TSurveyQuestion } from "@formbricks/types/surveys";

// Helper function to create an i18nString from a regular string.
export const createI18nString = (
  text: string | TI18nString,
  languages: string[],
  defaultLanguageId: string
): TI18nString => {
  if (typeof text === "object") {
    // It's already an i18n object, so clone it
    const i18nString: TI18nString = structuredClone(text);
    // Add new language keys with empty strings if they don't exist
    languages?.forEach((language) => {
      if (!(language in i18nString)) {
        i18nString[language] = "";
      }
    });

    // Remove language keys that are not in the languages array
    Object.keys(i18nString).forEach((key) => {
      if (key !== defaultLanguageId && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString: any = {
      [defaultLanguageId]: text as string, // Type assertion to assure TypeScript `text` is a string
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== defaultLanguageId) {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Function to translate a choice label
export const translateChoice = (choice: any, languages: string[], defaultLanguageId: string) => {
  // Assuming choice is a simple object and choice.label is a string.
  return {
    ...choice,
    label: createI18nString(choice.label, languages, defaultLanguageId),
  };
};
export const translateWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard,
  languages: string[],
  defaultLanguageId: string
): TSurveyWelcomeCard => {
  const clonedWelcomeCard = structuredClone(welcomeCard);
  clonedWelcomeCard.headline = createI18nString(welcomeCard.headline, languages, defaultLanguageId);
  clonedWelcomeCard.html = createI18nString(welcomeCard.html ?? "", languages, defaultLanguageId);
  if (clonedWelcomeCard.buttonLabel) {
    clonedWelcomeCard.buttonLabel = createI18nString(
      clonedWelcomeCard.buttonLabel,
      languages,
      defaultLanguageId
    );
  }

  return clonedWelcomeCard;
};

export const translateThankYouCard = (
  thankYouCard: TSurveyThankYouCard,
  languages: string[],
  defaultLanguageId: string
): TSurveyThankYouCard => {
  const clonedThankYouCard = structuredClone(thankYouCard);
  clonedThankYouCard.headline = createI18nString(
    thankYouCard.headline ? thankYouCard.headline : "",
    languages,
    defaultLanguageId
  );
  if (clonedThankYouCard.subheader) {
    clonedThankYouCard.subheader = createI18nString(
      thankYouCard.subheader ? thankYouCard.subheader : "",
      languages,
      defaultLanguageId
    );
  }

  return clonedThankYouCard;
};

// Function that will translate a single question
export const translateQuestion = (
  question: TSurveyQuestion,
  languages: string[],
  defaultLanguageId: string
) => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = structuredClone(question);

  clonedQuestion.headline = createI18nString(question.headline, languages, defaultLanguageId);
  if (clonedQuestion.subheader) {
    clonedQuestion.subheader = createI18nString(question.subheader ?? "", languages, defaultLanguageId);
  }

  if (clonedQuestion.buttonLabel) {
    clonedQuestion.buttonLabel = createI18nString(question.buttonLabel ?? "", languages, defaultLanguageId);
  }

  if (clonedQuestion.backButtonLabel) {
    clonedQuestion.backButtonLabel = createI18nString(
      question.backButtonLabel ?? "",
      languages,
      defaultLanguageId
    );
  }

  if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
    (clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion).choices =
      question.choices.map((choice) =>
        translateChoice(structuredClone(choice), languages, defaultLanguageId)
      );
    (
      clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion
    ).otherOptionPlaceholder = question.otherOptionPlaceholder
      ? createI18nString(question.otherOptionPlaceholder, languages, defaultLanguageId)
      : undefined;
  }
  if (question.type === "openText") {
    (clonedQuestion as TSurveyOpenTextQuestion).placeholder = createI18nString(
      question.placeholder ?? "",
      languages,
      defaultLanguageId
    );
  }
  if (question.type === "cta") {
    if (question.dismissButtonLabel) {
      (clonedQuestion as TSurveyCTAQuestion).dismissButtonLabel = createI18nString(
        question.dismissButtonLabel,
        languages,
        defaultLanguageId
      );
    }
    if (question.html) {
      (clonedQuestion as TSurveyCTAQuestion).html = createI18nString(
        question.html,
        languages,
        defaultLanguageId
      );
    }
  }
  if (question.type === "consent") {
    if (question.html) {
      (clonedQuestion as TSurveyConsentQuestion).html = createI18nString(
        question.html,
        languages,
        defaultLanguageId
      );
    }

    if (question.label) {
      (clonedQuestion as TSurveyConsentQuestion).label = createI18nString(
        question.label,
        languages,
        defaultLanguageId
      );
    }
  }
  if (question.type === "nps") {
    (clonedQuestion as TSurveyNPSQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages,
      defaultLanguageId
    );
    (clonedQuestion as TSurveyNPSQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages,
      defaultLanguageId
    );
  }
  if (question.type === "rating") {
    (clonedQuestion as TSurveyRatingQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages,
      defaultLanguageId
    );
    (clonedQuestion as TSurveyRatingQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages,
      defaultLanguageId
    );
  }
  return clonedQuestion;
};

// Function to translate an entire survey
export const translateSurvey = (
  survey: TSurvey,
  surveyLanguages: TLanguage[],
  defaultLanguageId: string
): TSurvey => {
  const languages = extractLanguageIds(surveyLanguages);
  const translatedQuestions = survey.questions.map((question) => {
    return translateQuestion(question, languages, defaultLanguageId);
  });
  const translatedWelcomeCard = translateWelcomeCard(survey.welcomeCard, languages, defaultLanguageId);
  const translatedThankYouCard = translateThankYouCard(survey.thankYouCard, languages, defaultLanguageId);
  const translatedSurvey = structuredClone(survey);
  return {
    ...translatedSurvey,
    questions: translatedQuestions,
    welcomeCard: translatedWelcomeCard,
    thankYouCard: translatedThankYouCard,
  };
};

export const isLabelValidForAllLanguages = (label: TI18nString, languages: string[]): boolean => {
  return languages.every((language) => label[language] && label[language].trim() !== "");
};

export const isSurveyAvailableInSelectedLanguage = (languageSymbol: string, survey: TSurvey) => {
  if (survey.questions[0].headline[languageSymbol]) {
    return true;
  }
  return false;
};

export const getSurveyLanguages = (product: TProduct, survey: TSurvey): TLanguage[] => {
  const languageCodes = Object.keys(survey.questions[0].headline);

  const surveyLanguages = languageCodes
    .map((code) => {
      const language = product.languages.find((lang) => lang.id === code);
      if (language) {
        return {
          id: code,
          default: language.default,
          alias: language.alias,
        };
      }
    })
    .filter((language): language is TLanguage => language !== undefined); // Filter out undefined values

  return surveyLanguages;
};

export const getLocalizedValue = (value: TI18nString | undefined, languageId: string): string => {
  if (!value) {
    return "";
  }
  if (isI18nString(value)) {
    if (value[languageId]) {
      return value[languageId];
    }
    return "";
  }
  return "";
};

function isI18nString(object: any): object is TI18nString {
  return typeof object === "object";
}

export const getDefaultLanguage = (languages: TLanguage[]): TLanguage => {
  const defaultLanguage = languages.find((language) => language.default === true);
  if (defaultLanguage) {
    return defaultLanguage;
  }
  return {
    id: "en",
    default: true,
    alias: "English",
  };
};

export const extractLanguageIds = (languages: TLanguage[]): string[] => {
  return languages.map((language) => language.id);
};

export const containsTranslations = (i18nString: TI18nString) => {
  return Object.entries(i18nString).length > 1;
};

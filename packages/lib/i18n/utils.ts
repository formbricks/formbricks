import { TLanguages, TProduct } from "@formbricks/types/product";
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
  defaultLanguageSymbol: string
): TI18nString => {
  if (typeof text === "object" && "_i18n_" in text) {
    // It's already an i18n object, so clone it
    const i18nString: TI18nString = structuredClone(text);
    i18nString._i18n_ = true;
    // Add new language keys with empty strings if they don't exist
    languages?.forEach((language) => {
      if (!(language in i18nString)) {
        i18nString[language] = "";
      }
    });

    // Remove language keys that are not in the languages array
    Object.keys(i18nString).forEach((key) => {
      if (key !== "_i18n_" && key !== defaultLanguageSymbol && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    if (Object.keys(i18nString).length === 2) {
      i18nString._i18n_ = false;
    }

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString: any = {
      _i18n_: languages.length > 1 ? true : false,
      [defaultLanguageSymbol]: text as string, // Type assertion to assure TypeScript `text` is a string
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== defaultLanguageSymbol) {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Function to translate a choice label
export const translateChoice = (choice: any, languages: string[], defaultLanguageSymbol: string) => {
  // Assuming choice is a simple object and choice.label is a string.
  return {
    ...choice,
    label: createI18nString(choice.label, languages, defaultLanguageSymbol),
  };
};
export const translateWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard,
  languages: string[],
  defaultLanguageSymbol: string
): TSurveyWelcomeCard => {
  const clonedWelcomeCard = structuredClone(welcomeCard);
  clonedWelcomeCard.headline = createI18nString(welcomeCard.headline, languages, defaultLanguageSymbol);
  clonedWelcomeCard.html = createI18nString(welcomeCard.html ?? "", languages, defaultLanguageSymbol);
  if (clonedWelcomeCard.buttonLabel) {
    clonedWelcomeCard.buttonLabel = createI18nString(
      clonedWelcomeCard.buttonLabel,
      languages,
      defaultLanguageSymbol
    );
  }

  return clonedWelcomeCard;
};

export const translateThankYouCard = (
  thankYouCard: TSurveyThankYouCard,
  languages: string[],
  defaultLanguageSymbol: string
): TSurveyThankYouCard => {
  const clonedThankYouCard = structuredClone(thankYouCard);
  clonedThankYouCard.headline = createI18nString(
    thankYouCard.headline ? thankYouCard.headline : "",
    languages,
    defaultLanguageSymbol
  );
  if (clonedThankYouCard.subheader) {
    clonedThankYouCard.subheader = createI18nString(
      thankYouCard.subheader ? thankYouCard.subheader : "",
      languages,
      defaultLanguageSymbol
    );
  }

  return clonedThankYouCard;
};

// Function that will translate a single question
export const translateQuestion = (
  question: TSurveyQuestion,
  languages: string[],
  defaultLanguageSymbol: string
) => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = structuredClone(question);

  clonedQuestion.headline = createI18nString(question.headline, languages, defaultLanguageSymbol);
  if (clonedQuestion.subheader) {
    clonedQuestion.subheader = createI18nString(question.subheader ?? "", languages, defaultLanguageSymbol);
  }

  if (clonedQuestion.buttonLabel) {
    clonedQuestion.buttonLabel = createI18nString(
      question.buttonLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
  }

  if (clonedQuestion.backButtonLabel) {
    clonedQuestion.backButtonLabel = createI18nString(
      question.backButtonLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
  }

  if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
    (clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion).choices =
      question.choices.map((choice) =>
        translateChoice(structuredClone(choice), languages, defaultLanguageSymbol)
      );
    (
      clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion
    ).otherOptionPlaceholder = question.otherOptionPlaceholder
      ? createI18nString(question.otherOptionPlaceholder, languages, defaultLanguageSymbol)
      : undefined;
  }
  if (question.type === "openText") {
    (clonedQuestion as TSurveyOpenTextQuestion).placeholder = createI18nString(
      question.placeholder ?? "",
      languages,
      defaultLanguageSymbol
    );
  }
  if (question.type === "cta") {
    if (question.dismissButtonLabel) {
      (clonedQuestion as TSurveyCTAQuestion).dismissButtonLabel = createI18nString(
        question.dismissButtonLabel,
        languages,
        defaultLanguageSymbol
      );
    }
    if (question.html) {
      (clonedQuestion as TSurveyCTAQuestion).html = createI18nString(
        question.html,
        languages,
        defaultLanguageSymbol
      );
    }
  }
  if (question.type === "consent") {
    if (question.html) {
      (clonedQuestion as TSurveyConsentQuestion).html = createI18nString(
        question.html,
        languages,
        defaultLanguageSymbol
      );
    }

    if (question.label) {
      (clonedQuestion as TSurveyConsentQuestion).label = createI18nString(
        question.label,
        languages,
        defaultLanguageSymbol
      );
    }
  }
  if (question.type === "nps") {
    (clonedQuestion as TSurveyNPSQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
    (clonedQuestion as TSurveyNPSQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
  }
  if (question.type === "rating") {
    (clonedQuestion as TSurveyRatingQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
    (clonedQuestion as TSurveyRatingQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages,
      defaultLanguageSymbol
    );
  }
  return clonedQuestion;
};

// Function to translate an entire survey
export const translateSurvey = (
  survey: TSurvey,
  surveyLanguages: TLanguages,
  defaultLanguageSymbol: string
): TSurvey => {
  const languages = Object.keys(surveyLanguages);
  const translatedQuestions = survey.questions.map((question) => {
    return translateQuestion(question, languages, defaultLanguageSymbol);
  });
  const translatedWelcomeCard = translateWelcomeCard(survey.welcomeCard, languages, defaultLanguageSymbol);
  const translatedThankYouCard = translateThankYouCard(survey.thankYouCard, languages, defaultLanguageSymbol);
  const translatedSurvey = structuredClone(survey);
  return {
    ...translatedSurvey,
    questions: translatedQuestions,
    welcomeCard: translatedWelcomeCard,
    thankYouCard: translatedThankYouCard,
  };
};

// Function to retrieve the correct translation from an i18nObject
export const getTranslation = (i18nObject: TI18nString, languageCode: string): string => {
  // If the specific language translation exists, return it
  if (i18nObject[languageCode]) {
    return i18nObject[languageCode];
  }
  // If not, return the English version or a default fallback
  return i18nObject.en || "Translation not available";
};

export function convertArrayToObject(array2D: string[][]): Record<string, string> {
  return array2D.reduce(
    (obj: Record<string, string>, item) => {
      if (item.length >= 2) {
        const [key, value] = item;
        obj[key] = value;
      }
      return obj;
    },
    {} as Record<string, string>
  );
}

export function extractLanguageSymbols(array2D: string[][]): string[] {
  return array2D.map((item) => item[0]);
}

export const isLabelValidForAllLanguages = (label: string | TI18nString, languages: string[]): boolean => {
  if (typeof label === "string") {
    return label.trim() !== "";
  } else {
    return languages.every((language) => label[language] && label[language].trim() !== "");
  }
};

export const isSurveyAvailableInSelectedLanguage = (languageSymbol: string, survey: TSurvey) => {
  if ((survey.questions[0].headline as TI18nString)[languageSymbol]) {
    return true;
  }
  return false;
};

export const getSurveyLanguages = (product: TProduct, survey: TSurvey): TLanguages => {
  return Object.fromEntries(
    Object.entries(product.languages).filter(
      ([langCode]) => (survey.questions[0].headline as TI18nString)[langCode]
    )
  );
};

export const getLocalizedValue = (value: string | TI18nString | undefined, language: string): string => {
  if (!value) {
    return "";
  }
  if (isI18nString(value)) {
    if (value[language]) {
      return value[language];
    }
    return "";
  }
  return value; // If it's a string, return as it is
};

function isI18nString(object: any): object is TI18nString {
  return typeof object === "object" && object !== null && "_i18n_" in object;
}

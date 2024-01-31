import { TProduct } from "@formbricks/types/product";
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
// languages = ["german","hindi"]
export const createI18nString = (text: string | TI18nString, languages?: string[]): TI18nString => {
  if (typeof text === "object" && "_i18n_" in text) {
    // It's already an i18n object, so clone it
    const i18nString: TI18nString = JSON.parse(JSON.stringify(text));
    i18nString._i18n_ = true;
    // Add new language keys with empty strings if they don't exist
    languages?.forEach((language) => {
      if (!(language in i18nString)) {
        i18nString[language] = "";
      }
    });

    // Remove language keys that are not in the languages array
    Object.keys(i18nString).forEach((key) => {
      if (key !== "_i18n_" && key !== "en" && languages && !languages.includes(key)) {
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
      _i18n_: true,
      en: text as string, // Type assertion to assure TypeScript `text` is a string
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== "en") {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Function to translate a choice label
const translateChoice = (choice: any, languages?: string[]) => {
  // Assuming choice is a simple object and choice.label is a string.
  return {
    ...choice,
    label: createI18nString(choice.label, languages),
  };
};
export const translateWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard,
  languages?: string[]
): TSurveyWelcomeCard => {
  const clonedWelcomeCard = JSON.parse(JSON.stringify(welcomeCard));
  clonedWelcomeCard.headline = createI18nString(welcomeCard.headline, languages);
  clonedWelcomeCard.html = createI18nString(welcomeCard.html ?? "", languages);
  clonedWelcomeCard.buttonLabel = createI18nString(welcomeCard.buttonLabel ?? "", languages);

  return clonedWelcomeCard;
};

export const translateThankYouCard = (
  thankYouCard: TSurveyThankYouCard,
  languages?: string[]
): TSurveyThankYouCard => {
  const clonedThankYouCard = JSON.parse(JSON.stringify(thankYouCard));
  clonedThankYouCard.headline = createI18nString(
    thankYouCard.headline ? thankYouCard.headline : "",
    languages
  );
  clonedThankYouCard.subheader = createI18nString(
    thankYouCard.subheader ? thankYouCard.subheader : "",
    languages
  );
  return clonedThankYouCard;
};

// Function that will translate a single question
export const translateQuestion = (question: TSurveyQuestion, languages?: string[]) => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = JSON.parse(JSON.stringify(question));

  clonedQuestion.headline = createI18nString(question.headline, languages);
  clonedQuestion.subheader = clonedQuestion.subheader
    ? createI18nString(question.subheader ?? "", languages)
    : undefined;
  clonedQuestion.buttonLabel = createI18nString(question.buttonLabel ?? "", languages);
  clonedQuestion.backButtonLabel = createI18nString(question.backButtonLabel ?? "", languages);

  if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti") {
    (clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion).choices =
      question.choices.map((choice) => translateChoice(JSON.parse(JSON.stringify(choice)), languages));
    (
      clonedQuestion as TSurveyMultipleChoiceMultiQuestion | TSurveyMultipleChoiceMultiQuestion
    ).otherOptionPlaceholder = createI18nString(question.otherOptionPlaceholder ?? "", languages);
  }
  if (question.type === "openText") {
    (clonedQuestion as TSurveyOpenTextQuestion).placeholder = createI18nString(
      question.placeholder ?? "",
      languages
    );
  }
  if (question.type === "cta") {
    (clonedQuestion as TSurveyCTAQuestion).dismissButtonLabel = createI18nString(
      question.dismissButtonLabel ?? "",
      languages
    );
    (clonedQuestion as TSurveyCTAQuestion).html = createI18nString(question.html ?? "", languages);
  }
  if (question.type === "consent") {
    (clonedQuestion as TSurveyConsentQuestion).html = createI18nString(question.html ?? "", languages);
    (clonedQuestion as TSurveyConsentQuestion).label = createI18nString(question.label ?? "", languages);
  }
  if (question.type === "nps") {
    (clonedQuestion as TSurveyNPSQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages
    );
    (clonedQuestion as TSurveyNPSQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages
    );
  }
  if (question.type === "rating") {
    (clonedQuestion as TSurveyRatingQuestion).lowerLabel = createI18nString(
      question.lowerLabel ?? "",
      languages
    );
    (clonedQuestion as TSurveyRatingQuestion).upperLabel = createI18nString(
      question.upperLabel ?? "",
      languages
    );
  }
  return clonedQuestion;
};

// Function to translate an entire survey
export const translateSurvey = (survey: TSurvey, languages?: string[]): TSurvey => {
  const translatedQuestions = survey.questions.map((question) => {
    return translateQuestion(question, languages);
  });
  const translatedWelcomeCard = translateWelcomeCard(survey.welcomeCard, languages);
  const translatedThankYouCard = translateThankYouCard(survey.thankYouCard, languages);
  const translatedSurvey = JSON.parse(JSON.stringify(survey));
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

export const getSurveyLanguages = (product: TProduct, survey: TSurvey) => {
  return Object.entries(product.languages)
    .filter(([langCode]) => survey.questions[0].headline[langCode])
    .map((lang) => lang);
};

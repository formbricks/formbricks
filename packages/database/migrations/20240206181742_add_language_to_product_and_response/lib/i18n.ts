import { TLanguage } from "@formbricks/types/product";
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
      if (key !== defaultLanguageSymbol && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString: any = {
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

export const extractLanguageIds = (languages: TLanguage[]): string[] => {
  return languages.map((language) => language.id);
};

// Function to translate an entire survey
export const translateSurvey = (
  survey: Pick<TSurvey, "questions" | "welcomeCard" | "thankYouCard">,
  surveyLanguages: TLanguage[],
  defaultLanguageSymbol: string
): Pick<TSurvey, "questions" | "welcomeCard" | "thankYouCard"> => {
  const languages = extractLanguageIds(surveyLanguages);
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

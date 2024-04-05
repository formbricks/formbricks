import {
  TLegacySurveyChoice,
  TLegacySurveyQuestion,
  TLegacySurveyThankYouCard,
  TLegacySurveyWelcomeCard,
} from "@formbricks/types/LegacySurvey";
import { TLanguage } from "@formbricks/types/product";
import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyChoice,
  TSurveyConsentQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyQuestions,
  TSurveyRatingQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
  ZSurveyCTAQuestion,
  ZSurveyCalQuestion,
  ZSurveyConsentQuestion,
  ZSurveyFileUploadQuestion,
  ZSurveyMultipleChoiceMultiQuestion,
  ZSurveyMultipleChoiceSingleQuestion,
  ZSurveyNPSQuestion,
  ZSurveyOpenTextQuestion,
  ZSurveyPictureSelectionQuestion,
  ZSurveyQuestion,
  ZSurveyRatingQuestion,
  ZSurveyThankYouCard,
  ZSurveyWelcomeCard,
} from "@formbricks/types/surveys";
import { TSurvey, TSurveyMultipleChoiceMultiQuestion, TSurveyQuestion } from "@formbricks/types/surveys";

// Helper function to create an i18nString from a regular string.
export const createI18nString = (text: string | TI18nString, languages: string[]): TI18nString => {
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
      if (key !== "default" && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString: any = {
      ["default"]: text as string, // Type assertion to assure TypeScript `text` is a string
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== "default") {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Function to translate a choice label
const translateChoice = (choice: TSurveyChoice | TLegacySurveyChoice, languages: string[]): TSurveyChoice => {
  if (typeof choice.label !== "undefined") {
    return {
      ...choice,
      label: createI18nString(choice.label, languages),
    };
  } else {
    return {
      ...choice,
      label: choice.label,
    };
  }
};

export const translateWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard | TLegacySurveyWelcomeCard,
  languages: string[]
): TSurveyWelcomeCard => {
  const clonedWelcomeCard = structuredClone(welcomeCard);
  if (typeof welcomeCard.headline !== "undefined") {
    clonedWelcomeCard.headline = createI18nString(welcomeCard.headline ?? "", languages);
  }
  if (typeof welcomeCard.html !== "undefined") {
    clonedWelcomeCard.html = createI18nString(welcomeCard.html ?? "", languages);
  }
  if (typeof welcomeCard.buttonLabel !== "undefined") {
    clonedWelcomeCard.buttonLabel = createI18nString(clonedWelcomeCard.buttonLabel ?? "", languages);
  }

  return ZSurveyWelcomeCard.parse(clonedWelcomeCard);
};

const translateThankYouCard = (
  thankYouCard: TSurveyThankYouCard | TLegacySurveyThankYouCard,
  languages: string[]
): TSurveyThankYouCard => {
  const clonedThankYouCard = structuredClone(thankYouCard);

  if (typeof thankYouCard.headline !== "undefined") {
    clonedThankYouCard.headline = createI18nString(thankYouCard.headline ?? "", languages);
  }

  if (typeof thankYouCard.subheader !== "undefined") {
    clonedThankYouCard.subheader = createI18nString(thankYouCard.subheader ?? "", languages);
  }

  if (typeof clonedThankYouCard.buttonLabel !== "undefined") {
    clonedThankYouCard.buttonLabel = createI18nString(thankYouCard.buttonLabel ?? "", languages);
  }
  return ZSurveyThankYouCard.parse(clonedThankYouCard);
};

// Function that will translate a single question
const translateQuestion = (
  question: TLegacySurveyQuestion | TSurveyQuestion,
  languages: string[]
): TSurveyQuestion => {
  // Clone the question to avoid mutating the original
  const clonedQuestion = structuredClone(question);

  //common question properties
  if (typeof question.headline !== "undefined") {
    clonedQuestion.headline = createI18nString(question.headline ?? "", languages);
  }

  if (typeof question.subheader !== "undefined") {
    clonedQuestion.subheader = createI18nString(question.subheader ?? "", languages);
  }

  if (typeof question.buttonLabel !== "undefined") {
    clonedQuestion.buttonLabel = createI18nString(question.buttonLabel ?? "", languages);
  }

  if (typeof question.backButtonLabel !== "undefined") {
    clonedQuestion.backButtonLabel = createI18nString(question.backButtonLabel ?? "", languages);
  }

  switch (question.type) {
    case "openText":
      if (typeof question.placeholder !== "undefined") {
        (clonedQuestion as TSurveyOpenTextQuestion).placeholder = createI18nString(
          question.placeholder ?? "",
          languages
        );
      }
      return ZSurveyOpenTextQuestion.parse(clonedQuestion);

    case "multipleChoiceSingle":
    case "multipleChoiceMulti":
      (clonedQuestion as TSurveyMultipleChoiceSingleQuestion | TSurveyMultipleChoiceMultiQuestion).choices =
        question.choices.map((choice) => {
          return translateChoice(choice, languages);
        });
      if (
        typeof (clonedQuestion as TSurveyMultipleChoiceSingleQuestion | TSurveyMultipleChoiceMultiQuestion)
          .otherOptionPlaceholder !== "undefined"
      ) {
        (
          clonedQuestion as TSurveyMultipleChoiceSingleQuestion | TSurveyMultipleChoiceMultiQuestion
        ).otherOptionPlaceholder = createI18nString(question.otherOptionPlaceholder ?? "", languages);
      }
      if (question.type === "multipleChoiceSingle") {
        return ZSurveyMultipleChoiceSingleQuestion.parse(clonedQuestion);
      } else return ZSurveyMultipleChoiceMultiQuestion.parse(clonedQuestion);

    case "cta":
      if (typeof question.dismissButtonLabel !== "undefined") {
        (clonedQuestion as TSurveyCTAQuestion).dismissButtonLabel = createI18nString(
          question.dismissButtonLabel ?? "",
          languages
        );
      }
      if (typeof question.html !== "undefined") {
        (clonedQuestion as TSurveyCTAQuestion).html = createI18nString(question.html ?? "", languages);
      }
      return ZSurveyCTAQuestion.parse(clonedQuestion);

    case "consent":
      if (typeof question.html !== "undefined") {
        (clonedQuestion as TSurveyConsentQuestion).html = createI18nString(question.html ?? "", languages);
      }

      if (typeof question.label !== "undefined") {
        (clonedQuestion as TSurveyConsentQuestion).label = createI18nString(question.label ?? "", languages);
      }

      return ZSurveyConsentQuestion.parse(clonedQuestion);

    case "nps":
      if (typeof question.lowerLabel !== "undefined") {
        (clonedQuestion as TSurveyNPSQuestion).lowerLabel = createI18nString(
          question.lowerLabel ?? "",
          languages
        );
      }
      if (typeof question.upperLabel !== "undefined") {
        (clonedQuestion as TSurveyNPSQuestion).upperLabel = createI18nString(
          question.upperLabel ?? "",
          languages
        );
      }
      return ZSurveyNPSQuestion.parse(clonedQuestion);

    case "rating":
      if (typeof question.lowerLabel !== "undefined") {
        (clonedQuestion as TSurveyRatingQuestion).lowerLabel = createI18nString(
          question.lowerLabel ?? "",
          languages
        );
      }

      if (typeof question.upperLabel !== "undefined") {
        (clonedQuestion as TSurveyRatingQuestion).upperLabel = createI18nString(
          question.upperLabel ?? "",
          languages
        );
      }
      return ZSurveyRatingQuestion.parse(clonedQuestion);

    case "fileUpload":
      return ZSurveyFileUploadQuestion.parse(clonedQuestion);

    case "pictureSelection":
      return ZSurveyPictureSelectionQuestion.parse(clonedQuestion);

    case "cal":
      return ZSurveyCalQuestion.parse(clonedQuestion);

    default:
      return ZSurveyQuestion.parse(clonedQuestion);
  }
};

export const extractLanguageIds = (languages: TLanguage[]): string[] => {
  return languages.map((language) => language.id);
};

// Function to translate an entire survey
export const translateSurvey = (
  survey: Pick<TSurvey, "questions" | "welcomeCard" | "thankYouCard">,
  languageCodes: string[]
): Pick<TSurvey, "questions" | "welcomeCard" | "thankYouCard"> => {
  const translatedQuestions = survey.questions.map((question) => {
    return translateQuestion(question, languageCodes);
  });
  const translatedWelcomeCard = translateWelcomeCard(survey.welcomeCard, languageCodes);
  const translatedThankYouCard = translateThankYouCard(survey.thankYouCard, languageCodes);
  const translatedSurvey = structuredClone(survey);
  return {
    ...translatedSurvey,
    questions: translatedQuestions,
    welcomeCard: translatedWelcomeCard,
    thankYouCard: translatedThankYouCard,
  };
};

export const hasStringSubheaders = (questions: TSurveyQuestions): boolean => {
  for (const question of questions) {
    if (typeof question.subheader !== "undefined") {
      return true;
    }
  }
  return false;
};

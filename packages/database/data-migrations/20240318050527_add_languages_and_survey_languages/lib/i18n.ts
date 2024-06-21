import {
  TLegacySurveyChoice,
  TLegacySurveyQuestion,
  TLegacySurveyThankYouCard,
  TLegacySurveyWelcomeCard,
} from "@formbricks/types/LegacySurvey";
import { TLanguage } from "@formbricks/types/product";
import {
  TI18nString,
  TSurvey,
  TSurveyCTAQuestion,
  TSurveyChoice,
  TSurveyConsentQuestion,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyQuestion,
  TSurveyQuestions,
  TSurveyRatingQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
  ZSurveyAddressQuestion,
  ZSurveyCTAQuestion,
  ZSurveyCalQuestion,
  ZSurveyConsentQuestion,
  ZSurveyFileUploadQuestion,
  ZSurveyMatrixQuestion,
  ZSurveyMultipleChoiceQuestion,
  ZSurveyNPSQuestion,
  ZSurveyOpenTextQuestion,
  ZSurveyPictureSelectionQuestion,
  ZSurveyQuestion,
  ZSurveyRatingQuestion,
  ZSurveyThankYouCard,
  ZSurveyWelcomeCard,
} from "@formbricks/types/surveys";

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
    const i18nString: TI18nString = {
      ["default"]: text, // Type assertion to assure TypeScript `text` is a string
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

export const updateChoiceLanguage = (
  choice: TSurveyChoice,
  oldCode: string,
  newCode: string
): TSurveyChoice => {
  if (typeof choice.label !== "undefined" && Object.keys(choice.label).includes(oldCode)) {
    return {
      ...choice,
      label: updateLanguageCode(choice.label, oldCode, newCode),
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
      (clonedQuestion as TSurveyMultipleChoiceQuestion).choices = question.choices.map((choice) => {
        return translateChoice(choice, languages);
      });
      if (typeof (clonedQuestion as TSurveyMultipleChoiceQuestion).otherOptionPlaceholder !== "undefined") {
        (clonedQuestion as TSurveyMultipleChoiceQuestion).otherOptionPlaceholder = createI18nString(
          question.otherOptionPlaceholder ?? "",
          languages
        );
      }

      return ZSurveyMultipleChoiceQuestion.parse(clonedQuestion);

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
      const range = question.range;
      if (typeof range === "string") {
        const parsedRange = parseInt(range);
        // @ts-expect-error
        clonedQuestion.range = parsedRange;
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

export const updateLanguageCode = (i18nString: TI18nString, oldCode: string, newCode: string) => {
  const updatedI18nString = structuredClone(i18nString);
  if (Object.keys(i18nString).includes(oldCode)) {
    const text = i18nString[oldCode];
    delete updatedI18nString[oldCode];
    updatedI18nString[newCode] = text;
  }
  return updatedI18nString;
};

export const updateLanguageCodeForWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard,
  oldCode: string,
  newCode: string
) => {
  const clonedWelcomeCard = structuredClone(welcomeCard);
  if (welcomeCard.headline !== undefined && Object.keys(welcomeCard.headline).includes(oldCode)) {
    clonedWelcomeCard.headline = updateLanguageCode(welcomeCard.headline, oldCode, newCode);
  }

  if (welcomeCard.html !== undefined && Object.keys(welcomeCard.html).includes(oldCode)) {
    clonedWelcomeCard.html = updateLanguageCode(welcomeCard.html, oldCode, newCode);
  }

  if (welcomeCard.buttonLabel !== undefined && Object.keys(welcomeCard.buttonLabel).includes(oldCode)) {
    clonedWelcomeCard.buttonLabel = updateLanguageCode(welcomeCard.buttonLabel, oldCode, newCode);
  }

  return ZSurveyWelcomeCard.parse(clonedWelcomeCard);
};

export const updateLanguageCodeForThankYouCard = (
  thankYouCard: TSurveyThankYouCard,
  oldCode: string,
  newCode: string
) => {
  const clonedThankYouCard = structuredClone(thankYouCard);
  if (thankYouCard.headline !== undefined && Object.keys(thankYouCard.headline).includes(oldCode)) {
    clonedThankYouCard.headline = updateLanguageCode(thankYouCard.headline, oldCode, newCode);
  }

  if (thankYouCard.subheader !== undefined && Object.keys(thankYouCard.subheader).includes(oldCode)) {
    clonedThankYouCard.subheader = updateLanguageCode(thankYouCard.subheader, oldCode, newCode);
  }

  if (thankYouCard.buttonLabel !== undefined && Object.keys(thankYouCard.buttonLabel).includes(oldCode)) {
    clonedThankYouCard.buttonLabel = updateLanguageCode(thankYouCard.buttonLabel, oldCode, newCode);
  }
  return ZSurveyThankYouCard.parse(clonedThankYouCard);
};

export const updateLanguageCodeForQuestion = (
  question: TSurveyQuestion,
  oldCode: string,
  newCode: string
) => {
  const clonedQuestion = structuredClone(question);
  //common question properties
  if (typeof question.headline !== "undefined" && Object.keys(question.headline).includes(oldCode)) {
    clonedQuestion.headline = updateLanguageCode(question.headline, oldCode, newCode);
  }

  if (typeof question.subheader !== "undefined" && Object.keys(question.subheader).includes(oldCode)) {
    clonedQuestion.subheader = updateLanguageCode(question.subheader, oldCode, newCode);
  }

  if (typeof question.buttonLabel !== "undefined" && Object.keys(question.buttonLabel).includes(oldCode)) {
    clonedQuestion.buttonLabel = updateLanguageCode(question.buttonLabel, oldCode, newCode);
  }

  if (
    typeof question.backButtonLabel !== "undefined" &&
    Object.keys(question.backButtonLabel).includes(oldCode)
  ) {
    clonedQuestion.backButtonLabel = updateLanguageCode(question.backButtonLabel, oldCode, newCode);
  }

  switch (question.type) {
    case "openText":
      if (
        typeof question.placeholder !== "undefined" &&
        Object.keys(question.placeholder).includes(oldCode)
      ) {
        (clonedQuestion as TSurveyOpenTextQuestion).placeholder = updateLanguageCode(
          question.placeholder,
          oldCode,
          newCode
        );
      }
      return ZSurveyOpenTextQuestion.parse(clonedQuestion);

    case "multipleChoiceSingle":
    case "multipleChoiceMulti":
      (clonedQuestion as TSurveyMultipleChoiceQuestion).choices = question.choices.map((choice) => {
        return updateChoiceLanguage(choice, oldCode, newCode);
      });
      if (
        typeof question.otherOptionPlaceholder !== "undefined" &&
        Object.keys(question.otherOptionPlaceholder).includes(oldCode)
      ) {
        (clonedQuestion as TSurveyMultipleChoiceQuestion).otherOptionPlaceholder = updateLanguageCode(
          question.otherOptionPlaceholder,
          oldCode,
          newCode
        );
      }
      return ZSurveyMultipleChoiceQuestion.parse(clonedQuestion);

    case "cta":
      if (
        typeof question.dismissButtonLabel !== "undefined" &&
        Object.keys(question.dismissButtonLabel).includes(oldCode)
      ) {
        (clonedQuestion as TSurveyCTAQuestion).dismissButtonLabel = updateLanguageCode(
          question.dismissButtonLabel,
          oldCode,
          newCode
        );
      }
      if (typeof question.html !== "undefined" && Object.keys(question.html).includes(oldCode)) {
        (clonedQuestion as TSurveyCTAQuestion).html = updateLanguageCode(question.html, oldCode, newCode);
      }
      return ZSurveyCTAQuestion.parse(clonedQuestion);

    case "consent":
      if (typeof question.html !== "undefined" && Object.keys(question.html).includes(oldCode)) {
        (clonedQuestion as TSurveyConsentQuestion).html = updateLanguageCode(question.html, oldCode, newCode);
      }

      if (typeof question.label !== "undefined" && Object.keys(question.label).includes(oldCode)) {
        (clonedQuestion as TSurveyConsentQuestion).label = updateLanguageCode(
          question.label,
          oldCode,
          newCode
        );
      }
      return ZSurveyConsentQuestion.parse(clonedQuestion);

    case "nps":
      if (typeof question.lowerLabel !== "undefined" && Object.keys(question.lowerLabel).includes(oldCode)) {
        (clonedQuestion as TSurveyNPSQuestion).lowerLabel = updateLanguageCode(
          question.lowerLabel,
          oldCode,
          newCode
        );
      }
      if (typeof question.upperLabel !== "undefined" && Object.keys(question.upperLabel).includes(oldCode)) {
        (clonedQuestion as TSurveyNPSQuestion).upperLabel = updateLanguageCode(
          question.upperLabel,
          oldCode,
          newCode
        );
      }
      return ZSurveyNPSQuestion.parse(clonedQuestion);

    case "rating":
      if (typeof question.lowerLabel !== "undefined" && Object.keys(question.lowerLabel).includes(oldCode)) {
        (clonedQuestion as TSurveyRatingQuestion).lowerLabel = updateLanguageCode(
          question.lowerLabel,
          oldCode,
          newCode
        );
      }

      if (typeof question.upperLabel !== "undefined") {
        (clonedQuestion as TSurveyRatingQuestion).upperLabel = updateLanguageCode(
          question.upperLabel,
          oldCode,
          newCode
        );
      }
      return ZSurveyRatingQuestion.parse(clonedQuestion);

    case "matrix":
      (clonedQuestion as TSurveyMatrixQuestion).rows = question.rows.map((row) => {
        if (Object.keys(row).includes(oldCode)) {
          return updateLanguageCode(row, oldCode, newCode);
        } else return row;
      });

      (clonedQuestion as TSurveyMatrixQuestion).columns = question.columns.map((column) => {
        if (Object.keys(column).includes(oldCode)) {
          return updateLanguageCode(column, oldCode, newCode);
        } else return column;
      });
      return ZSurveyMatrixQuestion.parse(clonedQuestion);

    case "fileUpload":
      return ZSurveyFileUploadQuestion.parse(clonedQuestion);

    case "pictureSelection":
      return ZSurveyPictureSelectionQuestion.parse(clonedQuestion);

    case "cal":
      return ZSurveyCalQuestion.parse(clonedQuestion);

    case "address":
      return ZSurveyAddressQuestion.parse(clonedQuestion);

    default:
      return ZSurveyQuestion.parse(clonedQuestion);
  }
};

import {
  TI18nString,
  TSurveyCTAQuestion,
  TSurveyChoice,
  TSurveyConsentQuestion,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyQuestion,
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

export const updateLanguageCode = (i18nString: TI18nString, oldCode: string, newCode: string) => {
  const updatedI18nString = structuredClone(i18nString);
  if (Object.keys(i18nString).includes(oldCode)) {
    const text = i18nString[oldCode];
    delete updatedI18nString[oldCode];
    updatedI18nString[newCode] = text;
  }
  return updatedI18nString;
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

export const updateLanguageCodeForWelcomeCard = (
  welcomeCard: TSurveyWelcomeCard,
  oldCode: string,
  newCode: string
) => {
  const clonedWelcomeCard = structuredClone(welcomeCard);
  if (typeof welcomeCard.headline !== "undefined" && Object.keys(welcomeCard.headline).includes(oldCode)) {
    clonedWelcomeCard.headline = updateLanguageCode(welcomeCard.headline, oldCode, newCode);
  }

  if (typeof welcomeCard.html !== "undefined" && Object.keys(welcomeCard.html).includes(oldCode)) {
    clonedWelcomeCard.html = updateLanguageCode(welcomeCard.html, oldCode, newCode);
  }

  if (
    typeof welcomeCard.buttonLabel !== "undefined" &&
    Object.keys(welcomeCard.buttonLabel).includes(oldCode)
  ) {
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
  if (typeof thankYouCard.headline !== "undefined" && Object.keys(thankYouCard.headline).includes(oldCode)) {
    clonedThankYouCard.headline = updateLanguageCode(thankYouCard.headline, oldCode, newCode);
  }

  if (
    typeof thankYouCard.subheader !== "undefined" &&
    Object.keys(thankYouCard.subheader).includes(oldCode)
  ) {
    clonedThankYouCard.subheader = updateLanguageCode(thankYouCard.subheader, oldCode, newCode);
  }

  if (
    typeof thankYouCard.buttonLabel !== "undefined" &&
    Object.keys(thankYouCard.buttonLabel).includes(oldCode)
  ) {
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

      if (typeof question.upperLabel !== "undefined" && Object.keys(question.upperLabel).includes(oldCode)) {
        (clonedQuestion as TSurveyRatingQuestion).upperLabel = updateLanguageCode(
          question.upperLabel,
          oldCode,
          newCode
        );
      }
      return ZSurveyRatingQuestion.parse(clonedQuestion);

    case "matrix":
      (clonedQuestion as TSurveyMatrixQuestion).rows = question.rows.map((row) => {
        if (typeof row !== "undefined" && Object.keys(row).includes(oldCode)) {
          return updateLanguageCode(row, oldCode, newCode);
        } else return row;
      });

      (clonedQuestion as TSurveyMatrixQuestion).columns = question.columns.map((column) => {
        if (typeof column !== "undefined" && Object.keys(column).includes(oldCode)) {
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

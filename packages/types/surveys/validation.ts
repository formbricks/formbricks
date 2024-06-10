import {
  TI18nString,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyThankYouCard,
  TSurveyWelcomeCard,
} from "./types";

export const extractLanguageCodes = (surveyLanguages: TSurveyLanguage[]): string[] => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map((surveyLanguage) =>
    surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};

export const isLabelValidForAllLanguages = (label: TI18nString, surveyLanguages: TSurveyLanguage[]) => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languages = !languageCodes.length ? ["default"] : languageCodes;
  return languages.every((language) => label && label[language] && label[language].trim() !== "");
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

export const hasDuplicates = (labels: TI18nString[]) => {
  const flattenedLabels = labels
    .map((label) =>
      Object.keys(label)
        .map((lang) => {
          const text = label[lang].trim().toLowerCase();
          return text && `${lang}:${text}`;
        })
        .filter((text) => text)
    )
    .flat();
  const uniqueLabels = new Set(flattenedLabels);
  return uniqueLabels.size !== flattenedLabels.length;
};

// Validation logic for multiple choice questions
export const handleI18nCheckForMultipleChoice = (
  question: TSurveyMultipleChoiceQuestion,
  languages: TSurveyLanguage[]
): boolean => question.choices.every((choice) => isLabelValidForAllLanguages(choice.label, languages));

export const handleI18nCheckForMatrixLabels = (
  question: TSurveyMatrixQuestion,
  languages: TSurveyLanguage[]
): boolean => {
  const rowsAndColumns = [...question.rows, ...question.columns];
  return rowsAndColumns.every((label) => isLabelValidForAllLanguages(label, languages));
};

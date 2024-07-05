import { z } from "zod";
import { TI18nString, TSurveyLanguage, TSurveyQuestion } from "./types";

export const FORBIDDEN_IDS = [
  "userId",
  "source",
  "suid",
  "end",
  "start",
  "welcomeCard",
  "hidden",
  "verifiedEmail",
  "multiLanguage",
  "embed",
];

export const extractLanguageCodes = (surveyLanguages: TSurveyLanguage[]): string[] => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map((surveyLanguage) =>
    surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};

const validateLabelForAllLanguages = (label: TI18nString, surveyLanguages: TSurveyLanguage[]): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languages = !languageCodes.length ? ["default"] : languageCodes;
  const invalidLanguageCodes = languages.filter(
    (language) => !label || !label[language] || label[language].trim() === ""
  );

  return invalidLanguageCodes.map((invalidLanguageCode) => {
    if (invalidLanguageCode === "default") {
      return surveyLanguages.find((lang) => lang.default)?.language.code || "default";
    }

    return invalidLanguageCode;
  });
};

export const validateQuestionLabels = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  questionIndex: number
): z.IssueData | null => {
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  if (invalidLanguageCodes.length) {
    const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
    return {
      code: z.ZodIssueCode.custom,
      message: `${field} in question ${questionIndex + 1} is ${isDefaultOnly ? "invalid" : "not valid for the following languages: "}`,
      path: ["questions", questionIndex, field],
      params: isDefaultOnly ? undefined : { invalidLanguageCodes },
    };
  }

  return null;
};

export const validateCardFieldsForAllLanguages = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  cardType: "welcome" | "thankYou"
): z.IssueData | null => {
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  if (invalidLanguageCodes.length) {
    const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
    return {
      code: z.ZodIssueCode.custom,
      message: `${field} in ${cardType === "welcome" ? "Welcome" : "Thank You"} Card is ${isDefaultOnly ? "invalid" : "not valid for the following languages: "}`,
      path: [cardType === "welcome" ? "welcomeCard" : "thankYouCard", field],
      params: isDefaultOnly ? undefined : { invalidLanguageCodes },
    };
  }

  return null;
};

export const findLanguageCodesForDuplicateLabels = (
  labels: TI18nString[],
  surveyLanguages: TSurveyLanguage[]
): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languagesToCheck = languageCodes.length === 0 ? ["default"] : languageCodes;

  const duplicateLabels = new Set<string>();

  for (const language of languagesToCheck) {
    const labelTexts = labels.map((label) => label[language]?.trim()).filter(Boolean);
    const uniqueLabels = new Set(labelTexts);

    if (uniqueLabels.size !== labelTexts.length) {
      duplicateLabels.add(language);
    }
  }

  return Array.from(duplicateLabels);
};

// Checks if there is a cycle present in the survey data logic and returns all questions responsible for the cycle.
export const findQuestionsWithCyclicLogic = (questions: TSurveyQuestion[]): string[] => {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const cyclicQuestions: Set<string> = new Set();

  const checkForCyclicLogic = (questionId: string): boolean => {
    if (!visited[questionId]) {
      visited[questionId] = true;
      recStack[questionId] = true;

      const question = questions.find((question) => question.id === questionId);
      if (question && question.logic && question.logic.length > 0) {
        for (const logic of question.logic) {
          const destination = logic.destination;
          if (!destination) {
            continue;
          }

          if (!visited[destination] && checkForCyclicLogic(destination)) {
            cyclicQuestions.add(questionId);
            return true;
          } else if (recStack[destination]) {
            cyclicQuestions.add(questionId);
            return true;
          }
        }
      } else {
        // Handle default behavior
        const nextQuestionIndex = questions.findIndex((question) => question.id === questionId) + 1;
        const nextQuestion = questions[nextQuestionIndex];
        if (nextQuestion && !visited[nextQuestion.id] && checkForCyclicLogic(nextQuestion.id)) {
          return true;
        }
      }
    }

    recStack[questionId] = false;
    return false;
  };

  for (const question of questions) {
    checkForCyclicLogic(question.id);
  }

  return Array.from(cyclicQuestions);
};

// function to validate hidden field or question id
export const validateId = (
  type: "Hidden field" | "Question",
  field: string,
  existingQuestionIds: string[],
  existingHiddenFieldIds: string[]
): string | null => {
  if (field.trim() === "") {
    return `Please enter a ${type} Id.`;
  }

  const combinedIds = [...existingQuestionIds, ...existingHiddenFieldIds];

  if (combinedIds.findIndex((id) => id.toLowerCase() === field.toLowerCase()) !== -1) {
    return `${type} Id already exists in questions or hidden fields.`;
  }

  if (FORBIDDEN_IDS.includes(field)) {
    return `${type} Id not allowed.`;
  }

  if (field.includes(" ")) {
    return `${type} Id not allowed, avoid using spaces.`;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
    return `${type} Id not allowed, use only alphanumeric characters, hyphens, or underscores.`;
  }

  return null;
};

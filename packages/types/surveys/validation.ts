import { z } from "zod";
import type {
  TActionJumpToQuestion,
  TConditionGroup,
  TI18nString,
  TSingleCondition,
  TSurveyLanguage,
  TSurveyLogicAction,
  TSurveyQuestion,
  TSurveyQuestionId,
} from "./types";

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
  "verify",
];

const FIELD_TO_LABEL_MAP: Record<string, string> = {
  headline: "question",
  subheader: "description",
  buttonLabel: "next button label",
  backButtonLabel: "back button label",
  placeholder: "placeholder",
  upperLabel: "upper label",
  lowerLabel: "lower label",
  "consent.label": "checkbox label",
  dismissButtonLabel: "dismiss button label",
  html: "description",
  cardHeadline: "note",
  welcomeCardHtml: "welcome message",
  endingCardButtonLabel: "button label",
};

const extractLanguageCodes = (surveyLanguages?: TSurveyLanguage[]): string[] => {
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
    (language) => !label[language] || label[language].trim() === ""
  );

  return invalidLanguageCodes.map((invalidLanguageCode) => {
    if (invalidLanguageCode === "default") {
      return surveyLanguages.find((lang) => lang.default)?.language.code ?? "default";
    }

    return invalidLanguageCode;
  });
};

export const validateQuestionLabels = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  questionIndex: number,
  skipArticle = false
): z.IssueData | null => {
  // fieldLabel should contain all the keys present in languages
  // even if one of the keys is an empty string, its okay but it shouldn't be undefined

  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: z.ZodIssueCode.custom,
        message: `The ${field} in question ${String(questionIndex + 1)} is not present for the following languages: ${language.language.code}`,
        path: ["questions", questionIndex, field],
      };
    }
  }

  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultOnly ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultOnly
    ? `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix}`
    : `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix} -fLang- ${invalidLanguageCodes.join()}`;

  if (invalidLanguageCodes.length) {
    return {
      code: z.ZodIssueCode.custom,
      message,
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
  cardType: "welcome" | "end",
  endingCardIndex?: number,
  skipArticle = false
): z.IssueData | null => {
  // fieldLabel should contain all the keys present in languages
  // even if one of the keys is an empty string, its okay but it shouldn't be undefined

  const cardTypeLabel =
    cardType === "welcome" ? "Welcome card" : `Ending card ${((endingCardIndex ?? -1) + 1).toString()}`; // Ensure 1-based indexing

  const path = cardType === "welcome" ? ["welcomeCard", field] : ["endings", endingCardIndex ?? -1, field];

  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: z.ZodIssueCode.custom,
        message: `The ${field} in ${cardTypeLabel} is not present for the following languages: ${language.language.code}`,
        path,
      };
    }
  }

  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultOnly ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultOnly
    ? `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix}`
    : `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix} -fLang- ${invalidLanguageCodes.join(", ")}`;

  if (invalidLanguageCodes.length) {
    return {
      code: z.ZodIssueCode.custom,
      message,
      path,
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
    const labelTexts = labels.map((label) => label[language].trim()).filter(Boolean);
    const uniqueLabels = new Set(labelTexts);

    if (uniqueLabels.size !== labelTexts.length) {
      duplicateLabels.add(language);
    }
  }

  return Array.from(duplicateLabels);
};

export const findQuestionsWithCyclicLogic = (questions: TSurveyQuestion[]): string[] => {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const cyclicQuestions = new Set<string>();

  const checkForCyclicLogic = (questionId: TSurveyQuestionId): boolean => {
    if (!visited[questionId]) {
      visited[questionId] = true;
      recStack[questionId] = true;

      const question = questions.find((ques) => ques.id === questionId);
      if (question?.logic && question.logic.length > 0) {
        for (const logic of question.logic) {
          const jumpActions = findJumpToQuestionActions(logic.actions);
          for (const jumpAction of jumpActions) {
            const destination = jumpAction.target;
            if (!visited[destination] && checkForCyclicLogic(destination)) {
              cyclicQuestions.add(questionId);
              return true;
            } else if (recStack[destination]) {
              cyclicQuestions.add(questionId);
              return true;
            }
          }
        }
      }

      // Check fallback logic
      if (question?.logicFallback) {
        const fallbackQuestionId = question.logicFallback;
        if (!visited[fallbackQuestionId] && checkForCyclicLogic(fallbackQuestionId)) {
          cyclicQuestions.add(questionId);
          return true;
        } else if (recStack[fallbackQuestionId]) {
          cyclicQuestions.add(questionId);
          return true;
        }
      }

      // Handle default behavior: move to the next question if no jump actions or fallback logic is defined
      const nextQuestionIndex = questions.findIndex((ques) => ques.id === questionId) + 1;
      const nextQuestion = questions[nextQuestionIndex] as TSurveyQuestion | undefined;
      if (nextQuestion && !visited[nextQuestion.id] && checkForCyclicLogic(nextQuestion.id)) {
        return true;
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

// Helper function to find all "jumpToQuestion" actions in the logic
const findJumpToQuestionActions = (actions: TSurveyLogicAction[]): TActionJumpToQuestion[] => {
  return actions.filter((action): action is TActionJumpToQuestion => action.objective === "jumpToQuestion");
};

// function to validate hidden field or question id
export const validateId = (
  type: "Hidden field" | "Question",
  field: string,
  existingQuestionIds: string[],
  existingEndingCardIds: string[],
  existingHiddenFieldIds: string[]
): string | null => {
  if (field.trim() === "") {
    return `Please enter a ${type} Id.`;
  }

  const combinedIds = [...existingQuestionIds, ...existingHiddenFieldIds, ...existingEndingCardIds];

  if (combinedIds.findIndex((id) => id.toLowerCase() === field.toLowerCase()) !== -1) {
    return `${type} ID already exists in questions or hidden fields.`;
  }

  if (FORBIDDEN_IDS.includes(field)) {
    return `${type} ID is not allowed.`;
  }

  if (field.includes(" ")) {
    return `${type} ID cannot contain spaces. Please remove spaces.`;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
    return `${type} ID is not allowed. Please use only alphanumeric characters, hyphens, or underscores.`;
  }

  return null;
};

type TCondition = TSingleCondition | TConditionGroup;

export const isConditionGroup = (condition: TCondition): condition is TConditionGroup => {
  return "conditions" in condition;
};

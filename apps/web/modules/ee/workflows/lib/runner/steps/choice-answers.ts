import { findByLocalizedLabel } from "@formbricks/types/surveys/localized-label";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import type { WorkflowRunSurveyResponse } from "../run-environment";

const RESPONSE_PREFIX = "response.";

/** A choice question's answer as choice ids; `undefined` when the path is no choice question's answer. */
export type WorkflowChoiceAnswerReader = (path: string, value: unknown) => string | string[] | undefined;

const NO_CHOICE_ANSWERS: WorkflowChoiceAnswerReader = () => undefined;

/**
 * Reads choice answers back to choice ids exactly as survey logic does (`apps/web/lib/surveyLogic`,
 * ENG-6943): a response stores the label in the respondent's language, so the label in that language
 * wins, then a label in any of the survey's languages, and an answer matching no choice is `other`
 * when the question offers it. A run without a survey response (Webhook) reads no choice answers.
 */
export const createChoiceAnswerReader = (
  surveyResponse: WorkflowRunSurveyResponse | null
): WorkflowChoiceAnswerReader => {
  if (!surveyResponse) return NO_CHOICE_ANSWERS;
  const { survey, response } = surveyResponse;
  const language = response.language ?? "default";
  // Labels are keyed `default` for the survey's default language, as the quota screen reads them.
  const defaultCode = survey.languages.find((entry) => entry.default)?.language.code;
  const languageId = language === defaultCode ? "default" : language;
  const elements = getElementsFromBlocks(survey.blocks);

  return (path, value) => {
    if (!path.startsWith(RESPONSE_PREFIX)) return undefined;
    const id = path.slice(RESPONSE_PREFIX.length);
    const element = elements.find((candidate) => candidate.id === id);
    if (element?.type !== "multipleChoiceSingle" && element?.type !== "multipleChoiceMulti") return undefined;

    const hasOther = element.choices.some((choice) => choice.id === "other");
    const toChoiceId = (label: unknown): string | undefined => {
      if (typeof label !== "string") return undefined;
      return findByLocalizedLabel(element.choices, label, languageId)?.id ?? (hasOther ? "other" : undefined);
    };

    if (typeof value === "string") return toChoiceId(value);
    if (Array.isArray(value)) {
      return [...new Set(value.map(toChoiceId).filter((choiceId) => choiceId !== undefined))];
    }
    return undefined;
  };
};

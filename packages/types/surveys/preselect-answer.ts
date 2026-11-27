import { TSurveyElementTypeEnum } from "./constants";
import { getLabelInLanguage } from "./localized-label";

/**
 * Pre-select answer (ENG-7437): a rule action that puts an answer into a later question before the
 * respondent sees it: one option of a single select, one or more of a multi select, or a value in a
 * free text or number question. The respondent sees it already given and may change it; the response
 * stores only what they submit from that page. A page the respondent never sees (jumped over, or not
 * shown) stores nothing, so a pre-selected answer there is not an answer.
 *
 * It names options by id, never by label, so one action works in every survey language: the survey
 * turns the ids into labels in the respondent's language when the page opens, the way a respondent's
 * own pick is stored.
 *
 * Shared by the schema (`blocks.ts`), both rule validators, the renderer and the editor, so a value
 * one of them accepts the others accept too.
 */

/** Generous caps (CODING_STANDARDS "Input Limits"): far above any real select, finite for every request. */
export const PRESELECT_ANSWER_MAX_CHOICES = 200;
export const PRESELECT_ANSWER_MAX_TEXT_LENGTH = 5000;

// The question types an answer can be pre-selected in, as the plain strings `element.type` holds here.
const SINGLE_SELECT: string = TSurveyElementTypeEnum.MultipleChoiceSingle;
const MULTI_SELECT: string = TSurveyElementTypeEnum.MultipleChoiceMulti;
const OPEN_TEXT: string = TSurveyElementTypeEnum.OpenText;

/** The question types an answer can be pre-selected in. */
export const PRESELECTABLE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  SINGLE_SELECT,
  MULTI_SELECT,
  OPEN_TEXT,
]);

/** The "Other" option needs the respondent's own text, so it cannot be pre-selected. */
export const OTHER_CHOICE_ID = "other";

export type TPreselectAnswerValue =
  | { type: "choices"; choiceIds: readonly string[] }
  | { type: "static"; value: string };

/** What the rules that ran pre-selected, by question id. A later action for the same question wins. */
export type TPreselections = Record<string, TPreselectAnswerValue>;

/** The slice of a question this module reads. */
export interface TPreselectableElement {
  id: string;
  type: string;
  inputType?: string;
  choices?: readonly { id: string; label?: Record<string, string> }[];
}

export const isPreselectableElement = (element: { type: string }): boolean =>
  PRESELECTABLE_ELEMENT_TYPES.has(element.type);

const isNumeric = (value: string): boolean => value.trim() !== "" && Number.isFinite(Number(value));

/**
 * Why `value` can't be pre-selected in `element`, or `undefined` when it can. The message is a
 * sentence a creator or an API client reads as is.
 */
export const getPreselectAnswerValueIssue = (
  element: TPreselectableElement,
  value: TPreselectAnswerValue
): string | undefined => {
  if (!isPreselectableElement(element)) {
    return `An answer can only be pre-selected in a single select, multi select or free text question; question ${element.id} is a ${element.type} question.`;
  }

  if (element.type === OPEN_TEXT) {
    if (value.type !== "static") {
      return `Question ${element.id} is a free text question: pre-fill it with a value, not with options.`;
    }
    if (element.inputType === "number" && !isNumeric(value.value)) {
      return `Question ${element.id} takes a number: "${value.value}" is not one.`;
    }
    return undefined;
  }

  if (value.type !== "choices") {
    return `Question ${element.id} is a select question: pre-select one of its options, not a value.`;
  }
  if (element.type === SINGLE_SELECT && value.choiceIds.length > 1) {
    return `Question ${element.id} is a single select question: pre-select exactly one option.`;
  }
  if (new Set(value.choiceIds).size !== value.choiceIds.length) {
    return `Question ${element.id}: an option is pre-selected twice.`;
  }
  if (value.choiceIds.includes(OTHER_CHOICE_ID)) {
    return `Question ${element.id}: the "Other" option takes the respondent's own text, so it can't be pre-selected.`;
  }
  const choiceIds = new Set((element.choices ?? []).map((choice) => choice.id));
  const missing = value.choiceIds.find((choiceId) => !choiceIds.has(choiceId));
  if (missing !== undefined) {
    return `Question ${element.id} has no option ${missing}. Choose one of its options.`;
  }
  return undefined;
};

/**
 * The answer the page opens with: the options' labels in `languageId` (a single select's one label,
 * a multi select's list), or the free text value. `undefined` when nothing of it still fits the
 * question (an option deleted since, or the question's type changed), so a stale action pre-fills
 * nothing rather than a wrong answer.
 */
export const resolvePreselectedAnswer = (
  element: TPreselectableElement,
  value: TPreselectAnswerValue,
  languageId: string
): string | string[] | undefined => {
  if (getPreselectAnswerValueIssue(element, value) !== undefined) return undefined;
  if (value.type === "static") return value.value;

  const labels = value.choiceIds.map((choiceId) =>
    getLabelInLanguage(element.choices?.find((choice) => choice.id === choiceId)?.label, languageId)
  );
  if (labels.some((label) => label === "")) return undefined;
  return element.type === SINGLE_SELECT ? labels[0] : labels;
};

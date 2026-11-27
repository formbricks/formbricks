import { NONE_OPTION_ID, OTHER_OPTION_ID } from "./codes";
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
/** An option id is short; this only keeps a request from sending a long one. */
export const PRESELECT_ANSWER_MAX_CHOICE_ID_LENGTH = 200;

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

/**
 * A number as a number input shows it: the HTML "valid floating-point number" form (`-1.5`, `2e3`).
 * `Number()` would also take `0x10` or `0b1`, which the input clears, so the respondent would see an
 * empty field while the answer held the text.
 */
const NUMBER_INPUT_VALUE = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;
const isNumeric = (value: string): boolean => NUMBER_INPUT_VALUE.test(value);

/** Why a free text question can't open with `value`, or `undefined`. */
const getTextValueIssue = (
  element: TPreselectableElement,
  value: TPreselectAnswerValue
): string | undefined => {
  if (value.type !== "static") {
    return `Question ${element.id} is a free text question: pre-select a value, not options.`;
  }
  if (element.inputType === "number" && !isNumeric(value.value)) {
    return `Question ${element.id} takes a number: "${value.value}" is not one.`;
  }
  return undefined;
};

/** Why a select question can't open with these options, or `undefined`. */
const getChoicesIssue = (
  element: TPreselectableElement,
  choiceIds: readonly string[]
): string | undefined => {
  // Checked here, not by the schema's array bounds: inside the action union those surface as a bare
  // "Invalid input", while this names the limit (CODING_STANDARDS "Input Limits").
  if (choiceIds.length > PRESELECT_ANSWER_MAX_CHOICES) {
    return `At most ${String(PRESELECT_ANSWER_MAX_CHOICES)} options can be pre-selected.`;
  }
  if (element.type === SINGLE_SELECT && choiceIds.length > 1) {
    return `Question ${element.id} is a single select question: pre-select exactly one option.`;
  }
  if (new Set(choiceIds).size !== choiceIds.length) {
    return `Question ${element.id}: an option is pre-selected twice.`;
  }
  if (choiceIds.includes(OTHER_OPTION_ID)) {
    return `Question ${element.id}: the "Other" option takes the respondent's own text, so it can't be pre-selected.`;
  }
  if (choiceIds.includes(NONE_OPTION_ID) && choiceIds.length > 1) {
    return `Question ${element.id}: "None of these" is picked alone, so it can't be pre-selected with other options.`;
  }
  const known = new Set((element.choices ?? []).map((choice) => choice.id));
  const missing = choiceIds.find((choiceId) => !known.has(choiceId));
  return missing === undefined
    ? undefined
    : `Question ${element.id} has no option ${missing}. Choose one of its options.`;
};

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
  if (element.type === OPEN_TEXT) return getTextValueIssue(element, value);
  if (value.type !== "choices") {
    return `Question ${element.id} is a select question: pre-select one of its options, not a value.`;
  }
  return getChoicesIssue(element, value.choiceIds);
};

/**
 * The answer the page opens with: the options' labels in `languageId` (a single select's one label,
 * a multi select's list), or the free text value. `undefined` when nothing of it still fits the
 * question (an option deleted since, or the question's type changed), so a stale action pre-selects
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
  if (labels.includes("")) return undefined;
  return element.type === SINGLE_SELECT ? labels[0] : labels;
};

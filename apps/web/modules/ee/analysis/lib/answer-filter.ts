import type { TCubeFilter } from "@formbricks/types/analysis";

/**
 * Answer filters (ENG-6637, ENG-6894): a chart filter rule on how the same submission answered another
 * question in the chart's Feedback Dataset. One rule is one public condition on the virtual member
 * `FeedbackRecords.answer`, with values `"<questionId>:<valueKey>"` naming one question; Cube's
 * queryRewrite (docker/cube/cube.js) expands it into a join on the submission. Pure, so the builder,
 * the validator and the AI prompt share it.
 */

export const ANSWER_MEMBER = "FeedbackRecords.answer";

/** Rules one query may hold: one per `AnswerFilterN` alias the Cube model joins. */
export const MAX_ANSWER_RULES = 25;

/**
 * How a question stores its answer, which decides the column a rule tests:
 * `choice` a single-select's option id, `multi` one record per selected option, `number` an NPS, CSAT,
 * CES or rating value. No survey question type stores a yes/no answer, so there is no boolean kind.
 */
export type TAnswerKind = "choice" | "multi" | "number";

export type TAnswerOperator = "equals" | "notEquals";

/** An option a rule may test for, keyed as the records store it. */
export type TAnswerOption = { value: string; label: string };

/** A question of the dataset an answer rule may name. */
export type TAnswerQuestion = {
  id: string;
  label: string;
  kind: TAnswerKind;
  options: TAnswerOption[];
};

/**
 * The operators each kind offers. A multi-select has no "does not contain" (ENG-6894): a join cannot
 * express it, and the correct fallback took 12–15 s on a large dataset.
 */
export const ANSWER_OPERATORS: Readonly<Record<TAnswerKind, readonly TAnswerOperator[]>> = {
  choice: ["equals", "notEquals"],
  multi: ["equals"],
  number: ["equals", "notEquals"],
};

const NUMERIC_VALUE = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

export const formatAnswerValue = (questionId: string, valueKey: string): string =>
  `${questionId}:${valueKey}`;

/** `"<questionId>:<valueKey>"` split at its first colon, or `null` when either half is empty. */
export const parseAnswerValue = (value: string): { questionId: string; valueKey: string } | null => {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) return null;
  return { questionId: value.slice(0, separator), valueKey: value.slice(separator + 1) };
};

export type TAnswerRuleProblem =
  | "malformed_value"
  | "several_questions"
  | "unknown_question"
  | "operator_not_allowed"
  | "value_not_allowed";

/**
 * What is wrong with one answer rule, or `null`. Without `questions` only the shape is checked; with
 * them the question must be one of the dataset's, the operator one its kind offers, and each value of
 * the kind's type.
 */
export const checkAnswerRule = (
  operator: string,
  values: readonly string[],
  questions?: ReadonlyMap<string, TAnswerQuestion>
): TAnswerRuleProblem | null => {
  const parsed = values.map(parseAnswerValue);
  if (parsed.some((value) => value === null)) return "malformed_value";
  const questionIds = new Set(parsed.map((value) => value?.questionId));
  if (questionIds.size !== 1) return "several_questions";
  if (!questions) return null;

  const question = questions.get([...questionIds][0] ?? "");
  if (!question) return "unknown_question";
  if (!(ANSWER_OPERATORS[question.kind] as readonly string[]).includes(operator)) {
    return "operator_not_allowed";
  }

  const valueKeys = parsed.map((value) => value?.valueKey ?? "");
  if (question.kind === "number" && !valueKeys.every((valueKey) => NUMERIC_VALUE.test(valueKey))) {
    return "value_not_allowed";
  }
  return null;
};

/**
 * Every question an answer rule in `filters` names, through nested groups. Tolerates a query the
 * validator has not seen yet: anything that is not a filter is skipped.
 */
export const collectAnswerQuestionIds = (filters: readonly TCubeFilter[] | undefined): string[] => {
  const ids = new Set<string>();
  const visit = (filter: unknown): void => {
    if (typeof filter !== "object" || filter === null) return;
    const node = filter as Record<string, unknown>;
    for (const group of [node.and, node.or]) {
      if (Array.isArray(group)) group.forEach(visit);
    }
    if (node.member !== ANSWER_MEMBER || !Array.isArray(node.values)) return;
    for (const value of node.values) {
      const parsed = typeof value === "string" ? parseAnswerValue(value) : null;
      if (parsed) ids.add(parsed.questionId);
    }
  };
  if (Array.isArray(filters)) filters.forEach(visit);
  return [...ids];
};

/**
 * The chart builder's filter row names an answer rule's question in its field, since a row with no value
 * picked yet must still know it: `FeedbackRecords.answer:<questionId>`. Only the builder uses this form;
 * the query it writes is the public condition.
 */
const ANSWER_BUILDER_FIELD_PREFIX = `${ANSWER_MEMBER}:`;

/** "is any of" in the builder: an `equals` with several values, offered as its own operator. */
export const ANSWER_IS_ANY_OF_OPERATOR = "isAnyOf";

export const toAnswerBuilderField = (questionId: string): string =>
  `${ANSWER_BUILDER_FIELD_PREFIX}${questionId}`;

/** The question a builder field names, or `null` when it is not an answer rule's field. */
export const getAnswerBuilderQuestionId = (field: string): string | null =>
  field.startsWith(ANSWER_BUILDER_FIELD_PREFIX) && field.length > ANSWER_BUILDER_FIELD_PREFIX.length
    ? field.slice(ANSWER_BUILDER_FIELD_PREFIX.length)
    : null;

import { DATE_LITERAL_PATTERN } from "@formbricks/types/surveys/expression-types";
import type { TExpression } from "@formbricks/types/surveys/expressions";

/**
 * How Set value writes a date field (ENG-6968). A date field's Set value is stored as an expression
 * (P38), whichever way it is edited: the picker beside the expression box, and the one-step row
 * ("Set [date field] to [a day, a date answer or a date field]"), write the expression leaf the box
 * would hold if it were typed, so storage, v3 and the engines see nothing new.
 */

/**
 * The date an expression holds when it is one fixed date (`"2026-11-05"`), for the picker to show;
 * `null` for any other expression (`now()`, a formula, nothing yet).
 */
export const getFixedDate = (expression: TExpression): string | null =>
  expression.type === "static" &&
  typeof expression.value === "string" &&
  DATE_LITERAL_PATTERN.test(expression.value)
    ? expression.value
    : null;

/** The expression a picked day writes: that day as a date literal, in place of the whole expression. */
export const toFixedDateExpression = (day: string): TExpression => ({ type: "static", value: day });

/**
 * Whether a date field's expression is what the one-step row edits: nothing yet, one fixed date, or
 * one reference (a question's answer, a field). Anything else (`now()`, a formula) needs the
 * expression box, so the row opens there.
 */
export const isOneStepDateExpression = (expression: TExpression): boolean => {
  if (expression.type === "static") return expression.value === "" || getFixedDate(expression) !== null;
  return expression.type === "element" || expression.type === "variable" || expression.type === "hiddenField";
};

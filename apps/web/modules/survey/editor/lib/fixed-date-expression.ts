import { DATE_LITERAL_PATTERN } from "@formbricks/types/surveys/expression-types";
import type { TExpression } from "@formbricks/types/surveys/expressions";

/**
 * The date picker beside a date field's expression box (ENG-6968). A date field's Set value stays an
 * expression (P38); the picker only writes the quoted ISO date literal the box would hold if it were
 * typed, so storage, v3 and the engines see nothing new.
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

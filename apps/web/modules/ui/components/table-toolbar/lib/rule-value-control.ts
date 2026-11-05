import { isMultiValuePick, operatorTakesValue, operatorTakesValues } from "./operators";
import type { TFilterProperty, TRuleOperator } from "./types";

/** The rule operators that match one exact value, so a listed value is the one worth picking. */
const EXACT_OPERATORS: ReadonlySet<TRuleOperator> = new Set(["equals", "notEquals"]);

/**
 * What an Advanced filter rule's value slot shows, from its property and operator:
 *
 * - `placeholder`: no property or operator yet, so the slot holds its place, disabled.
 * - `none`: the operator compares against nothing (is set, is not set).
 * - `editor`: the conditions editor's own combobox: a list operator's multi-pick over fixed options, or
 *   typed text with values already seen as suggestions.
 * - `picker`: one value picked from the property's fixed or looked-up values; an enum's always are.
 * - `multiPicker`: several values picked from the property's fixed or looked-up values: `equals` /
 *   `notEquals` with `multiValueEquals`, `contains` / `doesNotContain` with `multiValueContains`, and any
 *   list operator on looked-up values, which the editor's combobox cannot list.
 * - `date`, `number`, `text`: a value typed, or a day picked.
 */
export type TRuleValueControl =
  | "placeholder"
  | "none"
  | "editor"
  | "picker"
  | "multiPicker"
  | "date"
  | "number"
  | "text";

export const getRuleValueControl = (
  property: TFilterProperty | undefined,
  operator: TRuleOperator | ""
): TRuleValueControl => {
  if (!property || !operator) return "placeholder";
  if (!operatorTakesValue(operator)) return "none";
  if (operatorTakesValues(operator, property)) {
    return isMultiValuePick(operator, property) || property.loadOptions ? "multiPicker" : "editor";
  }
  if (property.valueType === "date") return "date";

  const hasFixedValues = Boolean(property.options?.length) && !property.loadOptions;
  const hasValues = Boolean(property.options?.length) || Boolean(property.loadOptions);
  // A listed value is what an exact match wants; "contains" and the like want typed text, unless the
  // property's few fixed values are all there is to compare against.
  if (hasValues && EXACT_OPERATORS.has(operator)) return "picker";
  if (property.valueType === "enum" && hasFixedValues) return "picker";
  if (property.valueType === "number") return "number";
  if (property.suggestions?.length) return "editor";
  return "text";
};

import { createId } from "@paralleldrive/cuid2";
import type {
  TGenericCondition,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import { operatorTakesValue } from "./operators";
import type { TFilterProperty, TRuleOperator, TTableFilter } from "./types";
import { isCalendarDay } from "./url-codec";

// Advanced filter edits rules in `ConditionsEditor`'s shape and saves them back as table filters. Rules
// combine with AND only (ENG-3539), so the group is flat and its connector fixed.

export const emptyCondition = (): TGenericCondition => ({
  id: createId(),
  leftOperand: { value: "", type: "property" },
  operator: "",
});

export const rulesToConditionGroup = (rules: readonly TTableFilter[]): TGenericConditionGroup => ({
  id: "advanced-filter",
  connector: "and",
  conditions:
    rules.length > 0
      ? rules.map((rule) => ({
          id: createId(),
          leftOperand: { value: rule.property, type: "property" },
          operator: rule.operator,
          rightOperand: rule.values[0] === undefined ? undefined : { value: rule.values[0], type: "static" },
        }))
      : [emptyCondition()],
});

const toValue = (condition: TGenericCondition): string => {
  const value = condition.rightOperand?.value;
  if (Array.isArray(value)) return value[0] ?? "";
  return value === undefined || value === null ? "" : String(value).trim();
};

export type TRuleValidation = { rules: TTableFilter[]; incomplete: string[] };

/**
 * The finished rows as rules, and the ids of rows started but left unfinished. A row nobody touched
 * (no property) is simply dropped; a row with a property but no operator, or a missing or malformed
 * value, blocks saving so a half-written rule never silently disappears.
 */
export const conditionGroupToRules = (
  group: TGenericConditionGroup,
  properties: readonly TFilterProperty[]
): TRuleValidation => {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const rules: TTableFilter[] = [];
  const incomplete: string[] = [];

  for (const item of group.conditions) {
    if ("conditions" in item) continue;
    const condition = item;
    if (!condition.leftOperand.value) continue;

    const property = propertyById.get(condition.leftOperand.value);
    const operator = condition.operator as TRuleOperator;
    if (!property?.ruleOperators?.includes(operator)) {
      incomplete.push(condition.id);
      continue;
    }
    if (!operatorTakesValue(operator)) {
      rules.push({ property: property.id, operator, values: [] });
      continue;
    }
    const value = toValue(condition);
    const isValid =
      value.length > 0 &&
      (property.valueType !== "number" || Number.isFinite(Number(value))) &&
      (property.valueType !== "date" || isCalendarDay(value));
    if (!isValid) {
      incomplete.push(condition.id);
      continue;
    }
    rules.push({ property: property.id, operator, values: [value] });
  }

  return { rules, incomplete };
};

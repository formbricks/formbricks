import { createId } from "@paralleldrive/cuid2";
import type {
  TGenericCondition,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import { operatorTakesValue, operatorTakesValues } from "./operators";
import type { TFilterProperty, TRuleOperator, TTableFilter } from "./types";
import { isCalendarDay } from "./url-codec";

// Advanced filter edits rules in `ConditionsEditor`'s shape and saves them back as table filters. Rules
// combine with AND only (ENG-3539), so the group is flat and its connector fixed.

export const emptyCondition = (): TGenericCondition => ({
  id: createId(),
  leftOperand: { value: "", type: "property" },
  operator: "",
});

const toRightOperand = (rule: TTableFilter): TGenericCondition["rightOperand"] => {
  if (operatorTakesValues(rule.operator)) return { value: [...rule.values], type: "static" };
  return rule.values[0] === undefined ? undefined : { value: rule.values[0], type: "static" };
};

/** A list operator's picked values, trimmed and de-duplicated. */
const toValues = (condition: TGenericCondition): string[] => {
  const value = condition.rightOperand?.value;
  const raw = Array.isArray(value) ? value : [value];
  const values = raw.map((item) => (item === undefined || item === null ? "" : String(item).trim()));
  return [...new Set(values.filter((item) => item.length > 0))];
};

export const rulesToConditionGroup = (rules: readonly TTableFilter[]): TGenericConditionGroup => ({
  id: "advanced-filter",
  connector: "and",
  conditions:
    rules.length > 0
      ? rules.map((rule) => ({
          id: createId(),
          leftOperand: { value: rule.property, type: "property" },
          operator: rule.operator,
          rightOperand: toRightOperand(rule),
        }))
      : [emptyCondition()],
});

const toValue = (condition: TGenericCondition): string => {
  const value = condition.rightOperand?.value;
  if (Array.isArray(value)) return value[0] ?? "";
  return value === undefined || value === null ? "" : String(value).trim();
};

export type TRuleValidation = { rules: TTableFilter[]; incomplete: string[] };

const isValidSingleValue = (property: TFilterProperty, value: string): boolean =>
  value.length > 0 &&
  (property.valueType !== "number" || Number.isFinite(Number(value))) &&
  (property.valueType !== "date" || isCalendarDay(value));

/** One row as a rule, or null when it was started but left unfinished. */
const conditionToRule = (
  condition: TGenericCondition,
  property: TFilterProperty | undefined
): TTableFilter | null => {
  const operator = condition.operator as TRuleOperator;
  if (!property?.ruleOperators?.includes(operator)) return null;
  if (!operatorTakesValue(operator)) return { property: property.id, operator, values: [] };
  if (operatorTakesValues(operator)) {
    const values = toValues(condition);
    return values.length > 0 ? { property: property.id, operator, values } : null;
  }
  const value = toValue(condition);
  return isValidSingleValue(property, value) ? { property: property.id, operator, values: [value] } : null;
};

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
    if ("conditions" in item || !item.leftOperand.value) continue;
    const rule = conditionToRule(item, propertyById.get(item.leftOperand.value));
    if (rule) rules.push(rule);
    else incomplete.push(item.id);
  }

  return { rules, incomplete };
};

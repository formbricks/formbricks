import { buildRule } from "./advanced-filter";
import { operatorTakesValues } from "./operators";
import { type TRuleValueControl, getRuleValueControl } from "./rule-value-control";
import type { TFilterProperty, TRuleOperator, TTableFilter } from "./types";

// The simple-first Filter menu (TableToolbar `filter.simpleRules`): every property listed and searchable,
// and one rule at a time edited in a popover on its chip, rather than in Advanced filter's dialog.

/** A property the Filter menu lists: a quick filter, or one a rule can be made on. */
export const isMenuProperty = (property: TFilterProperty): boolean =>
  !property.hidden && (Boolean(property.quick) || (property.ruleOperators?.length ?? 0) > 0);

/** Whether picking the property in the menu starts a rule, rather than opening its quick filter's list. */
export const startsRule = (property: TFilterProperty): boolean =>
  !property.quick && (property.ruleOperators?.length ?? 0) > 0;

/** The properties whose label or group holds the search, ignoring case and surrounding spaces. */
export const searchMenuProperties = (
  properties: readonly TFilterProperty[],
  search: string
): TFilterProperty[] => {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...properties];
  return properties.filter(
    (property) =>
      property.label.toLowerCase().includes(needle) || property.group?.toLowerCase().includes(needle)
  );
};

export type TPropertyGroup = { label: string; properties: TFilterProperty[] };

/** The properties under their `group` headings, in the order the properties first name each group. */
export const groupFilterProperties = (
  properties: readonly TFilterProperty[],
  defaultGroup: string
): TPropertyGroup[] => {
  const groups = new Map<string, TFilterProperty[]>();
  for (const property of properties) {
    const group = property.group ?? defaultGroup;
    groups.set(group, [...(groups.get(group) ?? []), property]);
  }
  return [...groups].map(([label, members]) => ({ label, properties: members }));
};

/** One rule while its popover is open: the operator and what is picked or typed for it. */
export type TRuleDraft = {
  operator: TRuleOperator | "";
  /** A single-value operator's value. */
  value: string;
  /** A list operator's values. */
  values: string[];
};

/** The draft a rule's popover opens on: the rule being edited, or the property's first operator. */
export const draftFromRule = (property: TFilterProperty, rule?: TTableFilter): TRuleDraft => {
  if (rule && property.ruleOperators?.includes(rule.operator as TRuleOperator)) {
    const operator = rule.operator as TRuleOperator;
    return operatorTakesValues(operator)
      ? { operator, value: "", values: [...rule.values] }
      : { operator, value: rule.values[0] ?? "", values: [] };
  }
  return { operator: property.ruleOperators?.[0] ?? "", value: "", values: [] };
};

/**
 * The value control the popover draws. The Advanced filter dialog leaves `editor` to its own combobox,
 * which the popover does not have: a list there is picked from the property's values, anything else typed.
 */
export const getPopoverValueControl = (
  property: TFilterProperty,
  operator: TRuleOperator | ""
): TRuleValueControl => {
  const control = getRuleValueControl(property, operator);
  if (control !== "editor") return control;
  return operator && operatorTakesValues(operator) ? "multiPicker" : "text";
};

/**
 * The draft after a switch of operator. What was picked or typed stays when the new operator takes the
 * same kind of value (is → is not, is any of → is none of); otherwise the value starts empty.
 */
export const switchDraftOperator = (
  property: TFilterProperty,
  draft: TRuleDraft,
  operator: TRuleOperator
): TRuleDraft => {
  if (getPopoverValueControl(property, draft.operator) === getPopoverValueControl(property, operator)) {
    return { ...draft, operator };
  }
  return { operator, value: "", values: [] };
};

/** The draft as a rule, or null while it is unfinished, so a half-written rule is never saved. */
export const draftToRule = (property: TFilterProperty, draft: TRuleDraft): TTableFilter | null => {
  if (!draft.operator) return null;
  return buildRule(
    property,
    draft.operator,
    operatorTakesValues(draft.operator) ? draft.values : draft.value
  );
};

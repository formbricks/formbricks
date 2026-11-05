"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericCondition,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { conditionGroupToRules, emptyCondition, rulesToConditionGroup } from "../lib/advanced-filter";
import { getRules, replaceRules } from "../lib/filter-state";
import { getOperatorName, operatorTakesValue } from "../lib/operators";
import { getRuleValueControl } from "../lib/rule-value-control";
import type { TFilterProperty, TRuleOperator, TTableFilter } from "../lib/types";
import { RuleValueInput } from "./rule-value-input";

const INPUT_TYPE_BY_VALUE_TYPE: Record<TFilterProperty["valueType"], string> = {
  string: "text",
  number: "number",
  date: "date",
  enum: "text",
};

/** The picker's option groups, in the order the properties first name them. */
const groupProperties = (properties: readonly TFilterProperty[], defaultGroup: string) => {
  const groups = new Map<string, TFilterProperty[]>();
  for (const property of properties) {
    const group = property.group ?? defaultGroup;
    groups.set(group, [...(groups.get(group) ?? []), property]);
  }
  return [...groups].map(([label, members]) => ({
    label,
    value: label,
    options: members.map((property) => ({
      label: property.label,
      value: property.id,
      icon: property.icon,
      meta: { type: "property" },
    })),
  }));
};

const isCondition = (item: TGenericCondition | TGenericConditionGroup): item is TGenericCondition =>
  !("conditions" in item);

/**
 * Advanced filter: `property · operator · value` rows, combined with AND only (ENG-3539). Saving turns
 * each finished row into its own filter, and so its own chip.
 */
export const AdvancedFilterDialog = ({
  open,
  onOpenChange,
  properties,
  filters,
  onFiltersChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: readonly TFilterProperty[];
  filters: readonly TTableFilter[];
  onFiltersChange: (filters: TTableFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const ruleProperties = properties.filter((property) => (property.ruleOperators?.length ?? 0) > 0);
  const [group, setGroup] = useState<TGenericConditionGroup>(() => rulesToConditionGroup(getRules(filters)));
  const [incompleteIds, setIncompleteIds] = useState<string[]>([]);

  const propertyFor = (condition: TGenericCondition) =>
    ruleProperties.find((property) => property.id === condition.leftOperand.value);

  /**
   * A row as an edit leaves it. Picking a property picks its first operator too, so the value control
   * that suits the property shows at once; switching between operators that take the same kind of
   * value (is → is not) keeps the value typed or picked.
   */
  const withDefaults = (
    condition: TGenericCondition,
    updates: Partial<TGenericCondition>
  ): TGenericCondition => {
    const next = { ...condition, ...updates };
    const property = propertyFor(next);
    if (updates.leftOperand && property && !next.operator) {
      next.operator = property.ruleOperators?.[0] ?? "";
    }
    const isOperatorSwitch =
      updates.operator !== undefined && updates.operator !== condition.operator && !updates.leftOperand;
    const previousControl = getRuleValueControl(property, condition.operator as TRuleOperator);
    if (
      isOperatorSwitch &&
      condition.rightOperand &&
      // A list keeps its picks across list operators (is any of → is none of); a single value only
      // between controls that take one.
      (previousControl === "multiPicker" || !Array.isArray(condition.rightOperand.value)) &&
      previousControl === getRuleValueControl(property, next.operator as TRuleOperator)
    ) {
      next.rightOperand = condition.rightOperand;
    }
    return next;
  };

  const updateConditions = (
    update: (conditions: TGenericConditionGroup["conditions"]) => TGenericConditionGroup["conditions"]
  ) => {
    setGroup((current) => ({ ...current, conditions: update(current.conditions) }));
    setIncompleteIds([]);
  };

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => groupProperties(ruleProperties, t("common.table_toolbar.properties")),
    getOperatorOptions: (condition) =>
      (propertyFor(condition)?.ruleOperators ?? []).map((operator) => ({
        label: getOperatorName(operator, t),
        value: operator,
      })),
    getValueProps: (condition) => {
      const property = propertyFor(condition);
      if (!property || !condition.operator || !operatorTakesValue(condition.operator as never)) {
        return { show: false, options: [] };
      }
      if (property.valueType === "enum" && property.options) {
        return {
          show: true,
          options: [
            {
              label: property.label,
              value: property.id,
              options: property.options.map((option) => ({ label: option.label, value: option.value })),
            },
          ],
        };
      }
      const suggested = property.suggestions?.map((value) => ({ label: value, value })) ?? [];
      return {
        show: true,
        // Values seen before, to pick from; typing anything else still makes a valid rule.
        options:
          suggested.length > 0 ? [{ label: property.label, value: property.id, options: suggested }] : [],
        showInput: true,
        inputType: INPUT_TYPE_BY_VALUE_TYPE[property.valueType],
      };
    },
    // The operator is chosen with the property (its first), in `onUpdateCondition`.
    getDefaultOperator: () => "",
    renderValueInput: (condition) => {
      const property = propertyFor(condition);
      const operator = condition.operator as TRuleOperator | "";
      if (getRuleValueControl(property, operator) === "editor") return undefined;
      const value = condition.rightOperand?.value;
      return (
        <RuleValueInput
          id={`advanced-filter-value-${condition.id}`}
          property={property}
          operator={operator}
          value={value === undefined || Array.isArray(value) ? "" : String(value)}
          values={Array.isArray(value) ? value : []}
          invalid={incompleteIds.includes(condition.id)}
          onChange={(next) =>
            callbacks.onUpdateCondition(condition.id, {
              rightOperand: next === "" ? undefined : { value: next, type: "static" },
            })
          }
          onValuesChange={(next) =>
            callbacks.onUpdateCondition(condition.id, {
              rightOperand: next.length === 0 ? undefined : { value: next, type: "static" },
            })
          }
        />
      );
    },
    showWhenLabel: false,
    leftOperandPlaceholder: t("common.table_toolbar.select_property"),
    operatorPlaceholder: t("common.table_toolbar.select_operator"),
    wideLeftOperandDropdown: true,
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: (id) =>
      updateConditions((conditions) => {
        const index = conditions.findIndex((condition) => condition.id === id);
        const next = [...conditions];
        next.splice(index + 1, 0, emptyCondition());
        return next;
      }),
    onRemoveCondition: (id) =>
      updateConditions((conditions) => {
        const next = conditions.filter((condition) => condition.id !== id);
        return next.length > 0 ? next : [emptyCondition()];
      }),
    onDuplicateCondition: (id) =>
      updateConditions((conditions) => {
        const index = conditions.findIndex((condition) => condition.id === id);
        const source = conditions[index];
        if (!source || !isCondition(source)) return conditions;
        const next = [...conditions];
        next.splice(index + 1, 0, { ...source, id: emptyCondition().id });
        return next;
      }),
    onUpdateCondition: (id, updates) =>
      updateConditions((conditions) =>
        conditions.map((condition) =>
          condition.id === id && isCondition(condition) ? withDefaults(condition, updates) : condition
        )
      ),
    // AND only: there is no connector to toggle.
    onToggleGroupConnector: () => undefined,
  };

  const handleSave = () => {
    const { rules, incomplete } = conditionGroupToRules(group, ruleProperties);
    if (incomplete.length > 0) {
      setIncompleteIds(incomplete);
      return;
    }
    onFiltersChange(replaceRules(filters, rules));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("common.table_toolbar.advanced_filter")}</DialogTitle>
          <DialogDescription>{t("common.table_toolbar.advanced_filter_description")}</DialogDescription>
        </DialogHeader>
        {/* The body scrolls, so it clips: a 4px margin it pads back keeps the controls' focus rings whole. */}
        <DialogBody className="-m-1 space-y-3 p-1">
          <ConditionsEditor conditions={group} config={config} callbacks={callbacks} isConnectorLocked />
          {/* Lined up under the rules' first field: past the 40px connector slot and its 8px gap, which
              only exists once there is an "and" to show. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={group.conditions.length > 1 ? "ml-12" : undefined}
            onClick={() => updateConditions((conditions) => [...conditions, emptyCondition()])}>
            <PlusIcon />
            {t("common.add_filter")}
          </Button>
          {incompleteIds.length > 0 && (
            <p role="alert" className="text-sm text-red-600">
              {t("common.table_toolbar.finish_or_remove_rules")}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

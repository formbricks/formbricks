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
import type { TFilterProperty, TTableFilter } from "../lib/types";

const INPUT_TYPE_BY_VALUE_TYPE: Record<TFilterProperty["valueType"], string> = {
  string: "text",
  number: "number",
  date: "date",
  enum: "text",
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

  const updateConditions = (
    update: (conditions: TGenericConditionGroup["conditions"]) => TGenericConditionGroup["conditions"]
  ) => {
    setGroup((current) => ({ ...current, conditions: update(current.conditions) }));
    setIncompleteIds([]);
  };

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => [
      {
        label: t("common.table_toolbar.properties"),
        value: "properties",
        options: ruleProperties.map((property) => ({
          label: property.label,
          value: property.id,
          meta: { type: "property" },
        })),
      },
    ],
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
      return {
        show: true,
        options: [],
        showInput: true,
        inputType: INPUT_TYPE_BY_VALUE_TYPE[property.valueType],
      };
    },
    getDefaultOperator: () => "",
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
          condition.id === id && isCondition(condition) ? { ...condition, ...updates } : condition
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
        <DialogBody className="space-y-3">
          <ConditionsEditor conditions={group} config={config} callbacks={callbacks} isConnectorLocked />
          <Button
            type="button"
            variant="ghost"
            size="sm"
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

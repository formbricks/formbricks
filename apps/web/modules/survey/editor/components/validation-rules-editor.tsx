"use client";

import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { v4 as uuidv7 } from "uuid";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";
import { createRuleParams, getAvailableRuleTypes, getRuleValue } from "../lib/validation-rules-utils";
import { ValidationRuleItem } from "./validation-rule-item";

interface ValidationRulesEditorProps {
  elementType: TSurveyElementTypeEnum;
  validationRules: TValidationRule[];
  onUpdateRules: (rules: TValidationRule[]) => void;
}

export const ValidationRulesEditor = ({
  elementType,
  validationRules,
  onUpdateRules,
}: ValidationRulesEditorProps) => {
  const { t } = useTranslation();

  const ruleLabels: Record<string, string> = {
    required: t("environments.surveys.edit.validation.required"),
    min_length: t("environments.surveys.edit.validation.min_length"),
    max_length: t("environments.surveys.edit.validation.max_length"),
    pattern: t("environments.surveys.edit.validation.pattern"),
    email: t("environments.surveys.edit.validation.email"),
    url: t("environments.surveys.edit.validation.url"),
    phone: t("environments.surveys.edit.validation.phone"),
    min_value: t("environments.surveys.edit.validation.min_value"),
    max_value: t("environments.surveys.edit.validation.max_value"),
    min_selections: t("environments.surveys.edit.validation.min_selections"),
    max_selections: t("environments.surveys.edit.validation.max_selections"),
    characters: t("environments.surveys.edit.validation.characters"),
    options_selected: t("environments.surveys.edit.validation.options_selected"),
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const isEnabled = validationRules.length > 0;

  const handleEnable = () => {
    const availableRules = getAvailableRuleTypes(elementType, []);
    if (availableRules.length > 0) {
      const defaultRuleType = availableRules[0];
      const config = RULE_TYPE_CONFIG[defaultRuleType];
      let defaultValue: number | string | undefined = undefined;
      if (config.needsValue && config.valueType === "text") {
        defaultValue = "";
      }
      const newRule: TValidationRule = {
        id: uuidv7(),
        type: defaultRuleType,
        params: createRuleParams(defaultRuleType, defaultValue),
      } as TValidationRule;
      onUpdateRules([newRule]);
    }
  };

  const handleDisable = () => {
    onUpdateRules([]);
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      handleEnable();
    } else {
      handleDisable();
    }
  };

  const handleAddRule = (insertAfterIndex: number) => {
    const availableRules = getAvailableRuleTypes(elementType, validationRules);
    if (availableRules.length === 0) return;

    const newRuleType = availableRules[0];
    const config = RULE_TYPE_CONFIG[newRuleType];
    let defaultValue: number | string | undefined = undefined;
    if (config.needsValue && config.valueType === "text") {
      defaultValue = "";
    }
    const newRule: TValidationRule = {
      id: uuidv7(),
      type: newRuleType,
      params: createRuleParams(newRuleType, defaultValue),
    } as TValidationRule;
    const newRules = [...validationRules];
    newRules.splice(insertAfterIndex + 1, 0, newRule);
    onUpdateRules(newRules);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = validationRules.filter((r) => r.id !== ruleId);
    onUpdateRules(updated);
  };

  const handleRuleTypeChange = (ruleId: string, newType: TValidationRuleType) => {
    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        type: newType,
        params: createRuleParams(newType),
      } as TValidationRule;
    });
    onUpdateRules(updated);
  };

  const handleRuleValueChange = (ruleId: string, value: string) => {
    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      const ruleType = rule.type;
      const config = RULE_TYPE_CONFIG[ruleType];
      const parsedValue = config.valueType === "number" ? Number(value) || 0 : value;
      return {
        ...rule,
        params: createRuleParams(ruleType, parsedValue),
      } as TValidationRule;
    });
    onUpdateRules(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = validationRules.findIndex((rule) => rule.id === active.id);
    const newIndex = validationRules.findIndex((rule) => rule.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newRules = [...validationRules];
      const [movedRule] = newRules.splice(oldIndex, 1);
      newRules.splice(newIndex, 0, movedRule);
      onUpdateRules(newRules);
    }
  };

  const availableRulesForAdd = getAvailableRuleTypes(elementType, validationRules);
  const canAddMore = availableRulesForAdd.length > 0;

  return (
    <AdvancedOptionToggle
      isChecked={isEnabled}
      onToggle={handleToggle}
      htmlId="validation-rules-toggle"
      title={t("environments.surveys.edit.validation_rules")}
      description={t("environments.surveys.edit.validation_rules_description")}
      customContainerClass="p-0 mt-4"
      childrenContainerClass="flex-col p-3 gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={validationRules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="flex w-full flex-col gap-2">
            {validationRules.map((rule, index) => {
              const ruleType = rule.type;
              const config = RULE_TYPE_CONFIG[ruleType];
              const currentValue = getRuleValue(rule);

              // Get available types for this rule (current type + unused types, no duplicates)
              const otherAvailableTypes = getAvailableRuleTypes(
                elementType,
                validationRules.filter((r) => r.id !== rule.id)
              ).filter((t) => t !== ruleType);
              const availableTypesForSelect = [ruleType, ...otherAvailableTypes];

              return (
                <ValidationRuleItem key={rule.id} id={rule.id}>
                  {/* Rule Type Selector */}
                  <Select
                    value={ruleType}
                    onValueChange={(value) => handleRuleTypeChange(rule.id, value as TValidationRuleType)}>
                    <SelectTrigger className={cn("bg-white", config.needsValue ? "w-[200px]" : "flex-1")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypesForSelect.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ruleLabels[RULE_TYPE_CONFIG[type].labelKey]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value Input (if needed) */}
                  {config.needsValue && (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        type={config.valueType === "number" ? "number" : "text"}
                        value={currentValue ?? ""}
                        onChange={(e) => handleRuleValueChange(rule.id, e.target.value)}
                        placeholder={config.valuePlaceholder}
                        className="min-w-[80px] h-9 bg-white"
                        min={config.valueType === "number" ? 0 : ""}
                      />

                      {/* Unit selector (if applicable) */}
                      {config.unitOptions && config.unitOptions.length > 0 && (
                        <Select value={config.unitOptions[0].value}>
                          <SelectTrigger className="flex-1 bg-white" disabled={config.unitOptions.length === 1}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {config.unitOptions.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {ruleLabels[unit.labelKey]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="shrink-0 bg-white">
                    <TrashIcon className="h-4 w-4" />
                  </Button>

                  {/* Add button */}
                  {canAddMore && (
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      onClick={() => handleAddRule(index)}
                      className="shrink-0 bg-white">
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  )}
                </ValidationRuleItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </AdvancedOptionToggle>
  );
};

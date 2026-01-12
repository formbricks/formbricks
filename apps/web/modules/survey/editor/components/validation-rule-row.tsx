"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyOpenTextElementInputType,
} from "@formbricks/types/surveys/elements";
import {
  TAddressField,
  TContactInfoField,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { Button } from "@/modules/ui/components/button";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";
import { getAvailableRuleTypes, getRuleValue } from "../lib/validation-rules-utils";
import { ValidationRuleFieldSelector } from "./validation-rule-field-selector";
import { ValidationRuleInputTypeSelector } from "./validation-rule-input-type-selector";
import { ValidationRuleTypeSelector } from "./validation-rule-type-selector";
import { ValidationRuleUnitSelector } from "./validation-rule-unit-selector";
import { ValidationRuleValueInput } from "./validation-rule-value-input";

interface ValidationRuleRowProps {
  rule: TValidationRule;
  index: number;
  elementType: TSurveyElementTypeEnum;
  element?: TSurveyElement;
  inputType?: TSurveyOpenTextElementInputType;
  onInputTypeChange?: (inputType: TSurveyOpenTextElementInputType) => void;
  fieldOptions: { value: TAddressField | TContactInfoField; label: string }[];
  needsFieldSelector: boolean;
  validationRules: TValidationRule[];
  ruleLabels: Record<string, string>;
  onFieldChange: (ruleId: string, field: TAddressField | TContactInfoField | undefined) => void;
  onRuleTypeChange: (ruleId: string, newType: TValidationRuleType) => void;
  onRuleValueChange: (ruleId: string, value: string) => void;
  onFileExtensionChange: (ruleId: string, extensions: TAllowedFileExtension[]) => void;
  onFileSizeUnitChange: (ruleId: string, unit: "KB" | "MB") => void;
  onDelete: (ruleId: string) => void;
  onAdd: (insertAfterIndex: number) => void;
  canAddMore: boolean;
}

export const ValidationRuleRow = ({
  rule,
  index,
  elementType,
  element,
  inputType,
  onInputTypeChange,
  fieldOptions,
  needsFieldSelector,
  validationRules,
  ruleLabels,
  onFieldChange,
  onRuleTypeChange,
  onRuleValueChange,
  onFileExtensionChange,
  onFileSizeUnitChange,
  onDelete,
  onAdd,
  canAddMore,
}: ValidationRuleRowProps) => {
  const ruleType = rule.type;
  const config = RULE_TYPE_CONFIG[ruleType];
  const currentValue = getRuleValue(rule);

  // Get available types for this rule (current type + unused types, no duplicates)
  // For address/contact info, filter by selected field
  const ruleField = rule.field;
  const otherAvailableTypes = getAvailableRuleTypes(
    elementType,
    validationRules.filter((r) => r.id !== rule.id),
    elementType === TSurveyElementTypeEnum.OpenText ? inputType : undefined,
    ruleField
  ).filter((t) => t !== ruleType);
  const availableTypesForSelect = [ruleType, ...otherAvailableTypes];

  // Check if this is OpenText and first rule - show input type selector
  const isOpenText = elementType === TSurveyElementTypeEnum.OpenText;
  const isFirstRule = index === 0;
  const showInputTypeSelector = isOpenText && isFirstRule;

  const handleFileExtensionChange = (extensions: TAllowedFileExtension[]) => {
    onFileExtensionChange(rule.id, extensions);
  };

  return (
    <div className="flex w-full items-center gap-2">
      {/* Field Selector (for Address and Contact Info elements) */}
      {needsFieldSelector && (
        <ValidationRuleFieldSelector
          value={rule.field}
          onChange={(value) => onFieldChange(rule.id, value)}
          fieldOptions={fieldOptions}
        />
      )}

      {/* Input Type Selector (only for OpenText, first rule) */}
      {showInputTypeSelector && inputType !== undefined && onInputTypeChange && (
        <ValidationRuleInputTypeSelector value={inputType} onChange={onInputTypeChange} />
      )}

      {/* Input Type Display (disabled, for subsequent rules) */}
      {isOpenText && !isFirstRule && inputType !== undefined && (
        <ValidationRuleInputTypeSelector value={inputType} disabled />
      )}

      {/* Rule Type Selector */}
      <ValidationRuleTypeSelector
        value={ruleType}
        onChange={(value) => onRuleTypeChange(rule.id, value)}
        availableTypes={availableTypesForSelect}
        ruleLabels={ruleLabels}
        needsValue={config.needsValue}
      />

      {/* Value Input (if needed) */}
      {config.needsValue && (
        <div className="flex w-full items-center gap-2">
          <ValidationRuleValueInput
            rule={rule}
            ruleType={ruleType}
            config={config}
            currentValue={currentValue}
            onChange={(value) => onRuleValueChange(rule.id, value)}
            onFileExtensionChange={handleFileExtensionChange}
            element={element}
          />

          {/* Unit selector (if applicable) */}
          {config.unitOptions && config.unitOptions.length > 0 && (
            <ValidationRuleUnitSelector
              value={
                ruleType === "fileSizeAtLeast" || ruleType === "fileSizeAtMost"
                  ? (rule.params as { size: number; unit: "KB" | "MB" }).unit
                  : config.unitOptions[0].value
              }
              onChange={
                ruleType === "fileSizeAtLeast" || ruleType === "fileSizeAtMost"
                  ? (value) => onFileSizeUnitChange(rule.id, value as "KB" | "MB")
                  : undefined
              }
              unitOptions={config.unitOptions}
              ruleLabels={ruleLabels}
              disabled={config.unitOptions.length === 1}
            />
          )}
        </div>
      )}

      {/* Delete button */}
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={() => onDelete(rule.id)}
        className="shrink-0 bg-white">
        <TrashIcon className="h-4 w-4" />
      </Button>

      {/* Add button */}
      {canAddMore && (
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => onAdd(index)}
          className="shrink-0 bg-white">
          <PlusIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

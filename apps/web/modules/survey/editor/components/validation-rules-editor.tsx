"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyOpenTextElementInputType,
  TValidationLogic,
} from "@formbricks/types/surveys/elements";
import {
  TAddressField,
  TContactInfoField,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { useGetBillingInfo } from "@/modules/utils/hooks/useGetBillingInfo";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";
import {
  getAddressFields,
  getContactInfoFields,
  getDefaultRuleValue,
  getRuleLabels,
  parseRuleValue,
} from "../lib/validation-rules-helpers";
import { RULES_BY_INPUT_TYPE, createRuleParams, getAvailableRuleTypes } from "../lib/validation-rules-utils";
import { ValidationLogicSelector } from "./validation-logic-selector";
import { ValidationRuleRow } from "./validation-rule-row";

type TValidationField = TAddressField | TContactInfoField | undefined;

interface ValidationRulesEditorProps {
  elementType: TSurveyElementTypeEnum;
  validation?: { rules: TValidationRule[]; logic?: TValidationLogic };
  onUpdateValidation: (validation: { rules: TValidationRule[]; logic: TValidationLogic }) => void;
  element?: TSurveyElement; // Optional, needed for single select option selection
  projectOrganizationId?: string; // For billing info to determine file size limits
  isFormbricksCloud?: boolean; // To determine if using Formbricks Cloud or self-hosted
  // For OpenText: input type and callback to update it
  inputType?: TSurveyOpenTextElementInputType;
  onUpdateInputType?: (inputType: TSurveyOpenTextElementInputType) => void;
}

export const ValidationRulesEditor = ({
  elementType,
  validation,
  onUpdateValidation,
  element,
  projectOrganizationId,
  isFormbricksCloud = false,
  inputType,
  onUpdateInputType,
}: ValidationRulesEditorProps) => {
  const validationRules = validation?.rules ?? [];
  const validationLogic = validation?.logic ?? "and";
  const { t } = useTranslation();

  // Field options for address and contact info elements
  const isAddress = elementType === TSurveyElementTypeEnum.Address;
  const isContactInfo = elementType === TSurveyElementTypeEnum.ContactInfo;
  const needsFieldSelector = isAddress || isContactInfo;

  let fieldOptions: { value: TAddressField | TContactInfoField; label: string }[] = [];
  if (isAddress) {
    fieldOptions = getAddressFields(t);
  } else if (isContactInfo) {
    fieldOptions = getContactInfoFields(t);
  }
  const {
    billingInfo,
    error: billingInfoError,
    isLoading: billingInfoLoading,
  } = useGetBillingInfo(projectOrganizationId ?? "");

  // Calculate max file size limit based on billing info (same logic as file-upload-element-form)
  const maxSizeInMBLimit = React.useMemo(() => {
    if (billingInfoError || billingInfoLoading || !billingInfo) {
      return 10; // Default to 10 MB
    }

    if (billingInfo.plan !== "free") {
      return 1024; // 1GB in MB for non-free plans
    }

    return 10; // 10 MB for free plan
  }, [billingInfo, billingInfoError, billingInfoLoading]);

  // For file upload elements, use billing-based limit; for self-hosted, use 1024 MB
  let effectiveMaxSizeInMB: number | undefined;
  if (elementType === TSurveyElementTypeEnum.FileUpload) {
    if (isFormbricksCloud) {
      effectiveMaxSizeInMB = maxSizeInMBLimit;
    } else {
      effectiveMaxSizeInMB = 1024;
    }
  } else {
    effectiveMaxSizeInMB = undefined;
  }

  const ruleLabels = getRuleLabels(t);

  const isEnabled = validationRules.length > 0;

  // For matrix elements, only show validation rules when element is not required
  const shouldShowValidationRules =
    elementType !== TSurveyElementTypeEnum.Matrix || (element && !element.required);

  const handleEnable = () => {
    // For address/contact info, get rules for first field
    const defaultField = needsFieldSelector && fieldOptions.length > 0 ? fieldOptions[0].value : undefined;
    const availableRules = getAvailableRuleTypes(
      elementType,
      [],
      elementType === TSurveyElementTypeEnum.OpenText ? inputType : undefined,
      defaultField
    );
    if (availableRules.length > 0) {
      const defaultRuleType = availableRules[0];
      const config = RULE_TYPE_CONFIG[defaultRuleType];
      const defaultValue = getDefaultRuleValue(config, element);
      const newRule: TValidationRule = {
        id: uuidv7(),
        type: defaultRuleType,
        params: createRuleParams(defaultRuleType, defaultValue),
        // For address/contact info, set field to first available field if not set
        field: needsFieldSelector && fieldOptions.length > 0 ? fieldOptions[0].value : undefined,
      } as TValidationRule;
      onUpdateValidation({ rules: [newRule], logic: validationLogic });
    }
  };

  const handleDisable = () => {
    onUpdateValidation({ rules: [], logic: validationLogic });
  };

  const handleAddRule = (insertAfterIndex: number) => {
    // For address/contact info, get rules for the field of the rule we're inserting after (or first field)
    const insertAfterRule = validationRules[insertAfterIndex];
    let fieldForNewRule: TValidationField;
    if (insertAfterRule?.field) {
      fieldForNewRule = insertAfterRule.field;
    } else if (needsFieldSelector && fieldOptions.length > 0) {
      fieldForNewRule = fieldOptions[0].value;
    }

    const availableRules = getAvailableRuleTypes(
      elementType,
      validationRules,
      elementType === TSurveyElementTypeEnum.OpenText ? inputType : undefined,
      fieldForNewRule
    );
    if (availableRules.length === 0) return;

    const newRuleType = availableRules[0];
    const config = RULE_TYPE_CONFIG[newRuleType];
    const defaultValue = getDefaultRuleValue(config, element);

    let defaultField: TValidationField;
    if (needsFieldSelector && fieldOptions.length > 0) {
      defaultField = fieldOptions[0].value;
    }

    const newRule: TValidationRule = {
      id: uuidv7(),
      type: newRuleType,
      params: createRuleParams(newRuleType, defaultValue),
      field: defaultField,
    } as TValidationRule;
    const newRules = [...validationRules];
    newRules.splice(insertAfterIndex + 1, 0, newRule);
    onUpdateValidation({ rules: newRules, logic: validationLogic });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = validationRules.filter((r) => r.id !== ruleId);
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  const handleRuleTypeChange = (ruleId: string, newType: TValidationRuleType) => {
    const ruleToUpdate = validationRules.find((r) => r.id === ruleId);
    if (!ruleToUpdate) return;

    // For address/contact info, verify the new rule type is valid for the selected field
    if (needsFieldSelector && ruleToUpdate.field) {
      const availableRulesForField = getAvailableRuleTypes(
        elementType,
        validationRules.filter((r) => r.id !== ruleId),
        undefined,
        ruleToUpdate.field
      );

      // If the new rule type is not available for this field, don't change it
      if (!availableRulesForField.includes(newType)) {
        return;
      }
    }

    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        type: newType,
        params: createRuleParams(newType),
      } as TValidationRule;
    });
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  const handleFieldChange = (ruleId: string, field: TValidationField) => {
    const ruleToUpdate = validationRules.find((r) => r.id === ruleId);
    if (!ruleToUpdate) return;

    // If changing field, check if current rule type is still valid for the new field
    // If not, change to first available rule type for that field
    let updatedRule = { ...ruleToUpdate, field } as TValidationRule;

    if (field) {
      const availableRulesForField = getAvailableRuleTypes(
        elementType,
        validationRules.filter((r) => r.id !== ruleId),
        undefined,
        field
      );

      // If current rule type is not available for the new field, change it
      if (!availableRulesForField.includes(ruleToUpdate.type) && availableRulesForField.length > 0) {
        updatedRule = {
          ...updatedRule,
          type: availableRulesForField[0],
          params: createRuleParams(availableRulesForField[0]),
        } as TValidationRule;
      }
    }

    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return updatedRule;
    });
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  const handleRuleValueChange = (ruleId: string, value: string) => {
    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      const ruleType = rule.type;
      const config = RULE_TYPE_CONFIG[ruleType];
      const parsedValue = parseRuleValue(ruleType, value, config, rule.params, effectiveMaxSizeInMB);

      return {
        ...rule,
        params: createRuleParams(ruleType, parsedValue),
      } as TValidationRule;
    });
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  const handleFileExtensionChange = (ruleId: string, extensions: TAllowedFileExtension[]) => {
    const updated = validationRules.map((r) => {
      if (r.id !== ruleId) return r;
      return {
        ...r,
        params: {
          extensions,
        },
      } as TValidationRule;
    });
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  const handleFileSizeUnitChange = (ruleId: string, unit: "KB" | "MB") => {
    const updated = validationRules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      const ruleType = rule.type;
      if (ruleType === "fileSizeAtLeast" || ruleType === "fileSizeAtMost") {
        const currentParams = rule.params as { size: number; unit: "KB" | "MB" };
        let size = currentParams.size;

        // For fileSizeAtMost, ensure it doesn't exceed billing-based limit
        if (ruleType === "fileSizeAtMost" && effectiveMaxSizeInMB !== undefined) {
          const sizeInMB = unit === "KB" ? size / 1024 : size;
          if (sizeInMB > effectiveMaxSizeInMB) {
            size = unit === "KB" ? effectiveMaxSizeInMB * 1024 : effectiveMaxSizeInMB;
          }
        }

        return {
          ...rule,
          params: {
            size,
            unit,
          },
        } as TValidationRule;
      }
      return rule;
    });
    onUpdateValidation({ rules: updated, logic: validationLogic });
  };

  // Handle input type change for OpenText
  const handleInputTypeChange = (newInputType: TSurveyOpenTextElementInputType) => {
    if (!onUpdateInputType) return;

    // Update element input type
    onUpdateInputType(newInputType);

    // Filter out incompatible rules based on new input type
    // Also remove redundant "email"/"url"/"phone" rules when inputType matches
    const compatibleRules = RULES_BY_INPUT_TYPE[newInputType] ?? [];
    const filteredRules = validationRules.filter((rule) => {
      // Remove rules that aren't compatible with the new input type
      if (!compatibleRules.includes(rule.type)) {
        return false;
      }
      // Remove redundant validation rules when inputType matches
      if (newInputType === "email" && rule.type === "email") {
        return false;
      }
      if (newInputType === "url" && rule.type === "url") {
        return false;
      }
      if (newInputType === "phone" && rule.type === "phone") {
        return false;
      }
      return true;
    });

    // If no compatible rules remain, add a default rule
    if (filteredRules.length === 0 && compatibleRules.length > 0) {
      const defaultRuleType = compatibleRules[0];
      const config = RULE_TYPE_CONFIG[defaultRuleType];
      let defaultValue: number | string | undefined = undefined;
      if (config.needsValue && config.valueType === "number") {
        defaultValue = 0;
      } else if (config.needsValue && config.valueType === "text") {
        defaultValue = "";
      }
      const defaultRule: TValidationRule = {
        id: uuidv7(),
        type: defaultRuleType,
        params: createRuleParams(defaultRuleType, defaultValue),
      } as TValidationRule;
      onUpdateValidation({ rules: [defaultRule], logic: validationLogic });
    } else if (filteredRules.length !== validationRules.length) {
      onUpdateValidation({ rules: filteredRules, logic: validationLogic });
    }
  };

  // For address/contact info, use first field if no rules exist, or use the field from last rule
  let defaultField: TValidationField;
  if (needsFieldSelector && validationRules.length > 0) {
    defaultField = validationRules.at(-1)?.field;
  } else if (needsFieldSelector && fieldOptions.length > 0) {
    defaultField = fieldOptions[0].value;
  } else {
    defaultField = undefined;
  }

  const availableRulesForAdd = getAvailableRuleTypes(
    elementType,
    validationRules,
    elementType === TSurveyElementTypeEnum.OpenText ? inputType : undefined,
    defaultField
  );
  const canAddMore = availableRulesForAdd.length > 0;

  // Don't show validation rules for required matrix elements
  if (!shouldShowValidationRules) {
    return null;
  }

  return (
    <AdvancedOptionToggle
      isChecked={isEnabled}
      onToggle={(checked) => (checked ? handleEnable() : handleDisable())}
      htmlId="validation-rules-toggle"
      title={t("environments.surveys.edit.validation_rules")}
      description={t("environments.surveys.edit.validation_rules_description")}
      customContainerClass="p-0 mt-4"
      childrenContainerClass="flex-col p-3 gap-2">
      {/* Validation Logic Selector - only show when there are 2+ rules */}
      {validationRules.length >= 2 && (
        <ValidationLogicSelector
          value={validationLogic}
          onChange={(value) => onUpdateValidation({ rules: validationRules, logic: value })}
        />
      )}
      <div className="flex w-full flex-col gap-2">
        {validationRules.map((rule, index) => (
          <ValidationRuleRow
            key={rule.id}
            rule={rule}
            index={index}
            elementType={elementType}
            element={element}
            inputType={inputType}
            onInputTypeChange={handleInputTypeChange}
            fieldOptions={fieldOptions}
            needsFieldSelector={needsFieldSelector}
            validationRules={validationRules}
            ruleLabels={ruleLabels}
            onFieldChange={handleFieldChange}
            onRuleTypeChange={handleRuleTypeChange}
            onRuleValueChange={handleRuleValueChange}
            onFileExtensionChange={handleFileExtensionChange}
            onFileSizeUnitChange={handleFileSizeUnitChange}
            onDelete={handleDeleteRule}
            onAdd={handleAddRule}
            canAddMore={canAddMore}
          />
        ))}
      </div>
    </AdvancedOptionToggle>
  );
};

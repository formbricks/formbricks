"use client";

import { capitalize } from "lodash";
import { PlusIcon, TrashIcon } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv7 } from "uuid";
import { TSurveyElement, TSurveyElementTypeEnum, TValidationLogic } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { TAllowedFileExtension, ALLOWED_FILE_EXTENSIONS } from "@formbricks/types/storage";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { cn } from "@/modules/ui/lib/utils";
import { useGetBillingInfo } from "@/modules/utils/hooks/useGetBillingInfo";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";
import { createRuleParams, getAvailableRuleTypes, getRuleValue } from "../lib/validation-rules-utils";

interface ValidationRulesEditorProps {
  elementType: TSurveyElementTypeEnum;
  validationRules: TValidationRule[];
  onUpdateRules: (rules: TValidationRule[]) => void;
  element?: TSurveyElement; // Optional, needed for single select option selection
  validationLogic?: TValidationLogic;
  onUpdateValidationLogic?: (logic: TValidationLogic) => void;
  projectOrganizationId?: string; // For billing info to determine file size limits
  isFormbricksCloud?: boolean; // To determine if using Formbricks Cloud or self-hosted
}

export const ValidationRulesEditor = ({
  elementType,
  validationRules,
  onUpdateRules,
  element,
  validationLogic = "and",
  onUpdateValidationLogic,
  projectOrganizationId,
  isFormbricksCloud = false,
}: ValidationRulesEditorProps) => {
  const { t } = useTranslation();
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
  const effectiveMaxSizeInMB = elementType === TSurveyElementTypeEnum.FileUpload
    ? (isFormbricksCloud ? maxSizeInMBLimit : 1024)
    : undefined;

  const ruleLabels: Record<string, string> = {
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
    is: t("environments.surveys.edit.validation.is"),
    is_not: t("environments.surveys.edit.validation.is_not"),
    contains: t("environments.surveys.edit.validation.contains"),
    does_not_contain: t("environments.surveys.edit.validation.does_not_contain"),
    is_longer_than: t("environments.surveys.edit.validation.is_longer_than"),
    is_shorter_than: t("environments.surveys.edit.validation.is_shorter_than"),
    is_greater_than: t("environments.surveys.edit.validation.is_greater_than"),
    is_less_than: t("environments.surveys.edit.validation.is_less_than"),
    is_on_or_later_than: t("environments.surveys.edit.validation.is_on_or_later_than"),
    is_later_than: t("environments.surveys.edit.validation.is_later_than"),
    is_on_or_earlier_than: t("environments.surveys.edit.validation.is_on_or_earlier_than"),
    is_earlier_than: t("environments.surveys.edit.validation.is_earlier_than"),
    is_between: t("environments.surveys.edit.validation.is_between"),
    is_not_between: t("environments.surveys.edit.validation.is_not_between"),
    is_selected: t("environments.surveys.edit.validation.is_selected"),
    is_not_selected: t("environments.surveys.edit.validation.is_not_selected"),
    position_is: t("environments.surveys.edit.validation.position_is"),
    position_is_higher_than: t("environments.surveys.edit.validation.position_is_higher_than"),
    position_is_lower_than: t("environments.surveys.edit.validation.position_is_lower_than"),
    answers_provided_greater_than: t("environments.surveys.edit.validation.answers_provided_greater_than"),
    answers_provided_smaller_than: t("environments.surveys.edit.validation.answers_provided_smaller_than"),
    file_size_at_least: t("environments.surveys.edit.validation.file_size_at_least"),
    file_size_at_most: t("environments.surveys.edit.validation.file_size_at_most"),
    file_extension_is: t("environments.surveys.edit.validation.file_extension_is"),
    file_extension_is_not: t("environments.surveys.edit.validation.file_extension_is_not"),
    kb: t("environments.surveys.edit.validation.kb"),
    mb: t("environments.surveys.edit.validation.mb"),
  };

  const isEnabled = validationRules.length > 0;

  // For matrix elements, only show validation rules when element is not required
  const shouldShowValidationRules =
    elementType !== TSurveyElementTypeEnum.Matrix || (element && !element.required);

  const handleEnable = () => {
    const availableRules = getAvailableRuleTypes(elementType, []);
    if (availableRules.length > 0) {
      const defaultRuleType = availableRules[0];
      const config = RULE_TYPE_CONFIG[defaultRuleType];
      let defaultValue: number | string | undefined = undefined;
      if (config.needsValue && config.valueType === "text") {
        defaultValue = "";
      } else if (config.needsValue && config.valueType === "option") {
        // For option type, get first available choice ID
        if (element && "choices" in element) {
          const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
          defaultValue = firstChoice?.id ?? "";
        } else {
          defaultValue = "";
        }
      } else if (config.needsValue && config.valueType === "ranking") {
        // For ranking type, get first available choice ID and default position 1
        if (element && "choices" in element) {
          const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
          defaultValue = firstChoice ? `${firstChoice.id},1` : ",1";
        } else {
          defaultValue = ",1";
        }
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

  const handleAddRule = (insertAfterIndex: number) => {
    const availableRules = getAvailableRuleTypes(elementType, validationRules);
    if (availableRules.length === 0) return;

    const newRuleType = availableRules[0];
    const config = RULE_TYPE_CONFIG[newRuleType];
    let defaultValue: number | string | undefined = undefined;
    if (config.needsValue && config.valueType === "text") {
      defaultValue = "";
    } else if (config.needsValue && config.valueType === "option") {
      // For option type, get first available choice ID
      if (element && "choices" in element) {
        const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
        defaultValue = firstChoice?.id ?? "";
      } else {
        defaultValue = "";
      }
    } else if (config.needsValue && config.valueType === "ranking") {
      // For ranking type, get first available choice ID and default position 1
      if (element && "choices" in element) {
        const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
        defaultValue = firstChoice ? `${firstChoice.id},1` : ",1";
      } else {
        defaultValue = ",1";
      }
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
      let parsedValue: string | number = value;

      // Handle file extension formatting: auto-add dot if missing
      if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {
        // Normalize extension: ensure it starts with a dot
        parsedValue = value.startsWith(".") ? value : `.${value}`;
      } else if (config.valueType === "number") {
        parsedValue = Number(value) || 0;
        
        // For fileSizeAtMost, ensure it doesn't exceed billing-based limit
        if (ruleType === "fileSizeAtMost" && effectiveMaxSizeInMB !== undefined) {
          const currentParams = rule.params as { size: number; unit: "KB" | "MB" };
          const unit = currentParams?.unit || "MB";
          const sizeInMB = unit === "KB" ? parsedValue / 1024 : parsedValue;
          
          // Cap the value at effectiveMaxSizeInMB
          if (sizeInMB > effectiveMaxSizeInMB) {
            parsedValue = unit === "KB" ? effectiveMaxSizeInMB * 1024 : effectiveMaxSizeInMB;
          }
        }
      }

      return {
        ...rule,
        params: createRuleParams(ruleType, parsedValue),
      } as TValidationRule;
    });
    onUpdateRules(updated);
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
    onUpdateRules(updated);
  };

  const availableRulesForAdd = getAvailableRuleTypes(elementType, validationRules);
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
      {validationRules.length >= 2 && onUpdateValidationLogic && (
        <div className="flex w-full items-center gap-2">
          <Select
            value={validationLogic}
            onValueChange={(value) => onUpdateValidationLogic(value as TValidationLogic)}>
            <SelectTrigger className="h-8 w-fit bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">{t("environments.surveys.edit.validation_logic_and")}</SelectItem>
              <SelectItem value="or">{t("environments.surveys.edit.validation_logic_or")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex w-full flex-col gap-2">
        {validationRules.map((rule, index) => {
          const ruleType = rule.type;
          const config = RULE_TYPE_CONFIG[ruleType];
          const currentValue = getRuleValue(rule);

          // For ranking rules, extract optionId and position from params
          const rankingParams =
            ruleType === "positionIs" ||
              ruleType === "positionIsHigherThan" ||
              ruleType === "positionIsLowerThan"
              ? rule.params
              : null;
          const rankingOptionId = rankingParams?.optionId ?? "";
          const rankingPosition = rankingParams?.position ?? 1;

          // Get available types for this rule (current type + unused types, no duplicates)
          const otherAvailableTypes = getAvailableRuleTypes(
            elementType,
            validationRules.filter((r) => r.id !== rule.id)
          ).filter((t) => t !== ruleType);
          const availableTypesForSelect = [ruleType, ...otherAvailableTypes];

          // Determine input type for non-range date rules
          let inputType: "number" | "date" | "text" = "text";
          if (config.valueType === "number") {
            inputType = "number";
          } else if (
            ruleType.startsWith("is") &&
            (ruleType.includes("Later") || ruleType.includes("Earlier") || ruleType.includes("On"))
          ) {
            inputType = "date";
          }

          return (
            <div key={rule.id} className="flex w-full items-center gap-2">
              {/* Rule Type Selector */}
              <Select
                value={ruleType}
                onValueChange={(value) => handleRuleTypeChange(rule.id, value as TValidationRuleType)}>
                <SelectTrigger className={cn("bg-white", config.needsValue ? "min-w-[200px]" : "flex-1")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypesForSelect.map((type) => (
                    <SelectItem key={type} value={type}>
                      {capitalize(ruleLabels[RULE_TYPE_CONFIG[type].labelKey])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value Input (if needed) */}
              {config.needsValue && (
                <div className="flex w-full items-center gap-2">
                  {ruleType === "isBetween" || ruleType === "isNotBetween" ? (
                    // Special handling for date range inputs
                    <div className="flex w-full items-center gap-2">
                      <Input
                        type="date"
                        value={(currentValue as string)?.split(",")?.[0] ?? ""}
                        onChange={(e) => {
                          const currentEndDate = (currentValue as string)?.split(",")?.[1] ?? "";
                          handleRuleValueChange(rule.id, `${e.target.value},${currentEndDate}`);
                        }}
                        placeholder="Start date"
                        className="h-9 flex-1 bg-white"
                      />
                      <span className="text-sm text-slate-500">and</span>
                      <Input
                        type="date"
                        value={(currentValue as string)?.split(",")?.[1] ?? ""}
                        onChange={(e) => {
                          const currentStartDate = (currentValue as string)?.split(",")?.[0] ?? "";
                          handleRuleValueChange(rule.id, `${currentStartDate},${e.target.value}`);
                        }}
                        placeholder="End date"
                        className="h-9 flex-1 bg-white"
                      />
                    </div>
                  ) : (
                    (() => {
                      if (config.valueType === "option") {
                        // Option selector for single select validation rules
                        const optionValue = typeof currentValue === "string" ? currentValue : "";
                        return (
                          <Select
                            value={optionValue}
                            onValueChange={(value) => handleRuleValueChange(rule.id, value)}>
                            <SelectTrigger className="h-9 min-w-[200px] bg-white">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              {element &&
                                "choices" in element &&
                                element.choices
                                  .filter(
                                    (choice) =>
                                      choice.id !== "other" && choice.id !== "none" && "label" in choice
                                  )
                                  .map((choice) => {
                                    const choiceLabel =
                                      "label" in choice
                                        ? choice.label.default || Object.values(choice.label)[0] || choice.id
                                        : choice.id;
                                    return (
                                      <SelectItem key={choice.id} value={choice.id}>
                                        {choiceLabel}
                                      </SelectItem>
                                    );
                                  })}
                            </SelectContent>
                          </Select>
                        );
                      }
                      if (config.valueType === "ranking") {
                        // Ranking rules: option selector + position input
                        return (
                          <div className="flex w-full items-center gap-2">
                            <Select
                              value={rankingOptionId}
                              onValueChange={(optionId) => {
                                handleRuleValueChange(rule.id, `${optionId},${rankingPosition}`);
                              }}>
                              <SelectTrigger className="h-9 min-w-[200px] bg-white">
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                              <SelectContent>
                                {element &&
                                  "choices" in element &&
                                  element.choices
                                    .filter(
                                      (choice) =>
                                        choice.id !== "other" && choice.id !== "none" && "label" in choice
                                    )
                                    .map((choice) => {
                                      const choiceLabel =
                                        "label" in choice
                                          ? choice.label.default ||
                                          Object.values(choice.label)[0] ||
                                          choice.id
                                          : choice.id;
                                      return (
                                        <SelectItem key={choice.id} value={choice.id}>
                                          {choiceLabel}
                                        </SelectItem>
                                      );
                                    })}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-slate-500">position</span>
                            <Input
                              type="number"
                              value={rankingPosition}
                              onChange={(e) => {
                                const newPosition = Number(e.target.value) || 1;
                                handleRuleValueChange(rule.id, `${rankingOptionId},${newPosition}`);
                              }}
                              placeholder="1"
                              className="h-9 w-20 bg-white"
                              min={1}
                            />
                          </div>
                        );
                      }
                      // File extension MultiSelect
                      if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {

                        const extensionOptions = ALLOWED_FILE_EXTENSIONS.map((ext) => ({
                          value: ext,
                          label: `.${ext}`,
                        }));
                        const selectedExtensions =
                          (rule.params as { extensions: string[] })?.extensions || [];
                        return (
                          <MultiSelect
                            options={extensionOptions}
                            value={selectedExtensions as TAllowedFileExtension[]}
                            onChange={(selected) => {
                              const updated = validationRules.map((r) => {
                                if (r.id !== rule.id) return r;
                                return {
                                  ...r,
                                  params: {
                                    extensions: selected,
                                  },
                                } as TValidationRule;
                              });
                              onUpdateRules(updated);
                            }}
                            placeholder={t("environments.surveys.edit.validation.select_file_extensions")}
                            disabled={false}
                          />
                        );
                      }
                      return (
                        <Input
                          type={inputType}
                          value={currentValue ?? ""}
                          onChange={(e) => handleRuleValueChange(rule.id, e.target.value)}
                          placeholder={config.valuePlaceholder}
                          className="h-9 min-w-[80px] bg-white"
                          min={config.valueType === "number" ? 0 : ""}
                        />
                      );
                    })()
                  )}

                  {/* Unit selector (if applicable) */}
                  {config.unitOptions && config.unitOptions.length > 0 && (
                    <Select
                      value={
                        ruleType === "fileSizeAtLeast" || ruleType === "fileSizeAtMost"
                          ? (rule.params as { size: number; unit: "KB" | "MB" }).unit
                          : config.unitOptions[0].value
                      }
                      onValueChange={
                        ruleType === "fileSizeAtLeast" || ruleType === "fileSizeAtMost"
                          ? (value) => handleFileSizeUnitChange(rule.id, value as "KB" | "MB")
                          : undefined
                      }>
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
            </div>
          );
        })}
      </div>
    </AdvancedOptionToggle>
  );
};

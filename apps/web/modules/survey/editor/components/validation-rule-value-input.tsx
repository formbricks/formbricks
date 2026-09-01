"use client";

import { useTranslation } from "react-i18next";
import { ALLOWED_FILE_EXTENSIONS, TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { RULE_TYPE_CONFIG } from "../lib/validation-rules-config";
import { ValidationRuleDateValueInput } from "./validation-rule-date-value-input";

interface ValidationRuleValueInputProps {
  rule: TValidationRule;
  ruleType: TValidationRuleType;
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType];
  currentValue: number | string | undefined;
  onChange: (value: string) => void;
  onFileExtensionChange: (extensions: TAllowedFileExtension[]) => void;
  onParamsChange: (params: TValidationRule["params"]) => void;
  element?: TSurveyElement;
}

export const ValidationRuleValueInput = ({
  rule,
  ruleType,
  config,
  currentValue,
  onChange,
  onFileExtensionChange,
  onParamsChange,
  element,
}: Readonly<ValidationRuleValueInputProps>) => {
  const { t } = useTranslation();

  if (config.supportsRelative) {
    return (
      <ValidationRuleDateValueInput
        rule={rule}
        ruleType={ruleType}
        currentValue={currentValue}
        onChange={onChange}
        onParamsChange={onParamsChange}
      />
    );
  }

  // Date rules return above; everything left is a plain text or number input.
  const htmlInputType = config.valueType === "number" ? "number" : "text";

  // Option selector for single select validation rules
  if (config.valueType === "option") {
    const optionValue = typeof currentValue === "string" ? currentValue : "";
    return (
      <Select value={optionValue} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[200px] bg-white">
          <SelectValue placeholder={t("workspace.surveys.edit.validation.select_option")} />
        </SelectTrigger>
        <SelectContent>
          {element &&
            "choices" in element &&
            element.choices
              .filter((choice) => choice.id !== "other" && choice.id !== "none" && "label" in choice)
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

  // File extension MultiSelect
  if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {
    const extensionOptions = ALLOWED_FILE_EXTENSIONS.map((ext) => ({
      value: ext,
      label: `.${ext}`,
    }));
    const selectedExtensions = (rule.params as { extensions: string[] })?.extensions || [];
    return (
      <MultiSelect
        options={extensionOptions}
        value={selectedExtensions as TAllowedFileExtension[]}
        onChange={onFileExtensionChange}
        placeholder={t("workspace.surveys.edit.validation.select_file_extensions")}
        disabled={false}
      />
    );
  }

  // Default text/number input
  return (
    <Input
      type={htmlInputType}
      value={currentValue ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config.valuePlaceholder}
      className="h-9 min-w-[80px] bg-white"
      min={config.valueType === "number" ? 0 : ""}
    />
  );
};

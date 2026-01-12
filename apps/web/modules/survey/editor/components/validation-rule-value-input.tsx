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

interface ValidationRuleValueInputProps {
  rule: TValidationRule;
  ruleType: TValidationRuleType;
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType];
  currentValue: number | string | undefined;
  onChange: (value: string) => void;
  onFileExtensionChange: (extensions: TAllowedFileExtension[]) => void;
  element?: TSurveyElement;
}

export const ValidationRuleValueInput = ({
  rule,
  ruleType,
  config,
  currentValue,
  onChange,
  onFileExtensionChange,
  element,
}: ValidationRuleValueInputProps) => {
  const { t } = useTranslation();

  // Determine HTML input type for value inputs
  let htmlInputType: "number" | "date" | "text" = "text";
  if (config.valueType === "number") {
    htmlInputType = "number";
  } else if (
    ruleType.startsWith("is") &&
    (ruleType.includes("Later") || ruleType.includes("Earlier") || ruleType.includes("On"))
  ) {
    htmlInputType = "date";
  }

  // Special handling for date range inputs
  if (ruleType === "isBetween" || ruleType === "isNotBetween") {
    return (
      <div className="flex w-full items-center gap-2">
        <Input
          type="date"
          value={(currentValue as string)?.split(",")?.[0] ?? ""}
          onChange={(e) => {
            const currentEndDate = (currentValue as string)?.split(",")?.[1] ?? "";
            onChange(`${e.target.value},${currentEndDate}`);
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
            onChange(`${currentStartDate},${e.target.value}`);
          }}
          placeholder="End date"
          className="h-9 flex-1 bg-white"
        />
      </div>
    );
  }

  // Option selector for single select validation rules
  if (config.valueType === "option") {
    const optionValue = typeof currentValue === "string" ? currentValue : "";
    return (
      <Select value={optionValue} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[200px] bg-white">
          <SelectValue placeholder="Select option" />
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
        placeholder={t("environments.surveys.edit.validation.select_file_extensions")}
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

"use client";

import { useTranslation } from "react-i18next";
import { ALLOWED_FILE_EXTENSIONS, TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { dateToInputValue, inputValueToDate } from "@/lib/utils/date-input";
import { DatePicker } from "@/modules/ui/components/date-picker";
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
    const [startDate, endDate] = (currentValue as string)?.split(",") ?? ["", ""];

    return (
      <div className="flex w-full items-center gap-2">
        <DatePicker
          date={startDate ? inputValueToDate(startDate) : null}
          updateSurveyDate={(date) => {
            onChange(`${dateToInputValue(date)},${endDate}`);
          }}
          placeholder={t("environments.surveys.edit.validation.start_date")}
          buttonClassName="h-9 w-full bg-white"
          className="flex-1"
        />
        <span className="text-sm text-slate-500">{t("common.and")}</span>
        <DatePicker
          date={endDate ? inputValueToDate(endDate) : null}
          updateSurveyDate={(date) => {
            onChange(`${startDate},${dateToInputValue(date)}`);
          }}
          placeholder={t("environments.surveys.edit.validation.end_date")}
          buttonClassName="h-9 w-full bg-white"
          className="flex-1"
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
          <SelectValue placeholder={t("environments.surveys.edit.validation.select_option")} />
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
  if (htmlInputType === "date") {
    const dateValue = typeof currentValue === "string" ? currentValue : "";

    return (
      <DatePicker
        date={dateValue ? inputValueToDate(dateValue) : null}
        updateSurveyDate={(date) => onChange(dateToInputValue(date))}
        placeholder={config.valuePlaceholder}
        buttonClassName="h-9 min-w-[180px] bg-white"
      />
    );
  }

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

"use client";

import { useTranslation } from "react-i18next";
import { ALLOWED_FILE_EXTENSIONS, TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";
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
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  // Date rules store the day as `yyyy-MM-dd`, and the two range rules store the pair comma-joined.
  const [startDay = "", endDay = ""] = (typeof currentValue === "string" ? currentValue : "").split(",");

  if (ruleType === "isBetween" || ruleType === "isNotBetween") {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex-1">
          <DatePicker
            value={parseStoredDay(startDay)}
            locale={locale}
            placeholder={t("workspace.surveys.edit.validation.start_date")}
            triggerClassName="h-9 w-full"
            onChange={(date) => onChange(`${formatLocalDay(date)},${endDay}`)}
          />
        </div>
        <span className="text-sm text-slate-500">{t("common.and")}</span>
        <div className="flex-1">
          <DatePicker
            value={parseStoredDay(endDay)}
            locale={locale}
            placeholder={t("workspace.surveys.edit.validation.end_date")}
            triggerClassName="h-9 w-full"
            onChange={(date) => onChange(`${startDay},${formatLocalDay(date)}`)}
          />
        </div>
      </div>
    );
  }

  if (ruleType === "isLaterThan" || ruleType === "isEarlierThan") {
    return (
      <DatePicker
        value={parseStoredDay(startDay)}
        locale={locale}
        triggerClassName="h-9 w-[200px]"
        onChange={(date) => onChange(formatLocalDay(date))}
      />
    );
  }

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
      type={config.valueType === "number" ? "number" : "text"}
      value={currentValue ?? ""}
      onChange={(e) => onChange(e.target.value)}
      // Browsers accept scientific notation in a number field, so `1e5` would silently store
      // 100000 and a bare `e` would store 0 while the field still shows the typed text. `.` and
      // `-` stay allowed: decimal and negative thresholds are valid per the rule schemas.
      // Modifier chords are let through — Ctrl/Cmd+E moves the caret in Chrome/Safari text fields
      // and Ctrl/Cmd++ zooms, and swallowing those while this field has focus is not the intent.
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (config.valueType === "number" && ["e", "E", "+"].includes(e.key)) e.preventDefault();
      }}
      placeholder={config.valuePlaceholder}
      className="h-9 min-w-[80px] bg-white"
      min={config.valueType === "number" ? 0 : ""}
    />
  );
};

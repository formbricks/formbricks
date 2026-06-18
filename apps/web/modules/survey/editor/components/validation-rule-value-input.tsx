"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ALLOWED_FILE_EXTENSIONS, TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TValidationRule, TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { cn } from "@/lib/cn";
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
  const [patternError, setPatternError] = useState<string | null>(null);

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
          placeholder={t("workspace.surveys.edit.validation.start_date")}
          className="h-9 flex-1 bg-white"
        />
        <span className="text-sm text-slate-500">{t("common.and")}</span>
        <Input
          type="date"
          value={(currentValue as string)?.split(",")?.[1] ?? ""}
          onChange={(e) => {
            const currentStartDate = (currentValue as string)?.split(",")?.[0] ?? "";
            onChange(`${currentStartDate},${e.target.value}`);
          }}
          placeholder={t("workspace.surveys.edit.validation.end_date")}
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

  // Pattern rule: compile the regex on blur so authors get an inline error before they save.
  // The API also rejects malformed patterns; this is the design-time guard that stops the bad
  // value from leaving the editor in the first place.
  if (ruleType === "pattern") {
    const patternValue = typeof currentValue === "string" ? currentValue : "";
    const validatePattern = (value: string) => {
      if (!value) {
        setPatternError(null);
        return;
      }
      try {
        new RegExp(value);
        setPatternError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid regular expression";
        setPatternError(message);
      }
    };

    // Reserve fixed space for the error so adding/removing the message does not push
    // sibling rows. The <p> is always rendered; we toggle visibility instead of mount.
    return (
      <div className="flex w-full flex-col gap-1">
        <Input
          type="text"
          value={patternValue}
          onChange={(e) => {
            if (patternError) setPatternError(null);
            onChange(e.target.value);
          }}
          onBlur={(e) => validatePattern(e.target.value)}
          placeholder={config.valuePlaceholder}
          className="h-9 min-w-[80px] bg-white"
          isInvalid={!!patternError}
          aria-invalid={!!patternError}
          aria-describedby={patternError ? `${rule.id}-pattern-error` : undefined}
        />
        <p
          id={`${rule.id}-pattern-error`}
          className={cn(
            "line-clamp-2 min-h-[2.25rem] text-xs leading-tight text-red-500",
            !patternError && "invisible"
          )}>
          {patternError ?? " "}
        </p>
      </div>
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

"use client";

import { useTranslation } from "react-i18next";
import { ALLOWED_FILE_EXTENSIONS, TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import {
  TRelativeDateBound,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
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
import {
  createRelativeDateParams,
  createRuleParams,
  isRelativeDateParams,
} from "../lib/validation-rules-utils";
import { ValidationRuleRelativeDateInput } from "./validation-rule-relative-date-input";

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
  const isRelative = isRelativeDateParams(rule.params);

  // Date rules bound either a fixed calendar date or an offset from the response date. The mode
  // select swaps the inputs and resets the params, since the two shapes share no fields.
  const renderDateModeSelect = () => (
    <Select
      value={isRelative ? "relative" : "fixed"}
      onValueChange={(mode) => {
        onParamsChange(mode === "relative" ? createRelativeDateParams(ruleType) : createRuleParams(ruleType));
      }}>
      <SelectTrigger
        className="h-9 w-44 shrink-0 bg-white"
        aria-label={t("workspace.surveys.edit.validation.date_mode")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fixed">{t("workspace.surveys.edit.validation.fixed_date")}</SelectItem>
        <SelectItem value="relative">
          {t("workspace.surveys.edit.validation.relative_to_response")}
        </SelectItem>
      </SelectContent>
    </Select>
  );

  if (config.supportsRelative) {
    const isRange = ruleType === "isBetween" || ruleType === "isNotBetween";

    if (isRelative) {
      const { relative, relativeStart, relativeEnd } = rule.params as {
        relative?: TRelativeDateBound;
        relativeStart?: TRelativeDateBound;
        relativeEnd?: TRelativeDateBound;
      };

      return (
        <div className="flex w-full flex-wrap items-center gap-2">
          {renderDateModeSelect()}
          {isRange && relativeStart && relativeEnd ? (
            <>
              <ValidationRuleRelativeDateInput
                bound={relativeStart}
                onChange={(bound) => onParamsChange({ relativeStart: bound, relativeEnd })}
              />
              <span className="text-sm text-slate-500">{t("common.and")}</span>
              <ValidationRuleRelativeDateInput
                bound={relativeEnd}
                onChange={(bound) => onParamsChange({ relativeStart, relativeEnd: bound })}
              />
            </>
          ) : null}
          {!isRange && relative ? (
            <ValidationRuleRelativeDateInput
              bound={relative}
              onChange={(bound) => onParamsChange({ relative: bound })}
            />
          ) : null}
        </div>
      );
    }

    if (isRange) {
      return (
        <div className="flex w-full flex-wrap items-center gap-2">
          {renderDateModeSelect()}
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

    return (
      <div className="flex w-full items-center gap-2">
        {renderDateModeSelect()}
        <Input
          type="date"
          value={(currentValue as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1 bg-white"
        />
      </div>
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

"use client";

import { useTranslation } from "react-i18next";
import {
  TRelativeDateBound,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  createRelativeDateParams,
  createRuleParams,
  isRelativeDateParams,
} from "../lib/validation-rules-utils";
import { ValidationRuleRelativeDateInput } from "./validation-rule-relative-date-input";

interface ValidationRuleDateValueInputProps {
  rule: TValidationRule;
  ruleType: TValidationRuleType;
  currentValue: number | string | undefined;
  onChange: (value: string) => void;
  onParamsChange: (params: TValidationRule["params"]) => void;
}

/**
 * The value side of a date validation rule: a mode select, then either fixed calendar dates or
 * offsets counted from the response date.
 */
export const ValidationRuleDateValueInput = ({
  rule,
  ruleType,
  currentValue,
  onChange,
  onParamsChange,
}: Readonly<ValidationRuleDateValueInputProps>) => {
  const { t } = useTranslation();

  const isRelative = isRelativeDateParams(rule.params);
  const isRange = ruleType === "isBetween" || ruleType === "isNotBetween";

  // The two modes share no fields, so switching resets the params to that mode's default.
  const modeSelect = (
    <Select
      value={isRelative ? "relative" : "fixed"}
      onValueChange={(mode) => {
        onParamsChange(mode === "relative" ? createRelativeDateParams(ruleType) : createRuleParams(ruleType));
      }}>
      <SelectTrigger
        className="h-9 w-32 shrink-0 bg-white whitespace-nowrap"
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

  if (isRelative) {
    const { relative, relativeStart, relativeEnd } = rule.params as {
      relative?: TRelativeDateBound;
      relativeStart?: TRelativeDateBound;
      relativeEnd?: TRelativeDateBound;
    };

    // Two relative bounds are six controls, which will not sit on one line next to the rule-type
    // select. Stack them so the amount / unit / direction columns line up instead of wrapping
    // ragged; "before" and "after" already say which bound is which, so no connective word.
    return (
      <div className="flex flex-[3] items-start gap-2">
        {modeSelect}
        {isRange && relativeStart && relativeEnd ? (
          <div className="flex flex-col gap-2">
            <ValidationRuleRelativeDateInput
              bound={relativeStart}
              onChange={(bound) => onParamsChange({ relativeStart: bound, relativeEnd })}
            />
            <ValidationRuleRelativeDateInput
              bound={relativeEnd}
              onChange={(bound) => onParamsChange({ relativeStart, relativeEnd: bound })}
            />
          </div>
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

  // Fixed range dates are stored as one "start,end" string.
  if (isRange) {
    const [startDate = "", endDate = ""] = ((currentValue as string) ?? "").split(",");

    return (
      <div className="flex flex-[3] flex-wrap items-center gap-2">
        {modeSelect}
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onChange(`${e.target.value},${endDate}`)}
          placeholder={t("workspace.surveys.edit.validation.start_date")}
          className="h-9 flex-1 bg-white"
        />
        <span className="text-sm text-slate-500">{t("common.and")}</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onChange(`${startDate},${e.target.value}`)}
          placeholder={t("workspace.surveys.edit.validation.end_date")}
          className="h-9 flex-1 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-[3] items-center gap-2">
      {modeSelect}
      <Input
        type="date"
        value={(currentValue as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 flex-1 bg-white"
      />
    </div>
  );
};

"use client";

import { useTranslation } from "react-i18next";
import {
  TRelativeDateBound,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { formatLocalDay } from "@/lib/utils/datetime";
import { DatePicker, DateRangePicker } from "@/modules/ui/components/date-picker";
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
  parseDateRangeRuleValue,
  parseDateRuleValue,
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
  const { t, i18n } = useTranslation();

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
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
        className="h-9 w-auto min-w-[112px] bg-white whitespace-nowrap"
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

    // Two relative bounds are eight controls, which will not sit on one line next to the rule-type
    // select. Stack them so the anchor / sign / amount / unit columns line up instead of wrapping
    // ragged; the signs already say which bound is which, so no connective word.
    return (
      <div className="flex min-w-0 flex-[3] items-start gap-2">
        {modeSelect}
        {isRange && relativeStart && relativeEnd ? (
          <div className="flex min-w-0 flex-col gap-2">
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

  // Fixed range dates are stored as one "start,end" string. One range calendar rather than two single
  // ones: the second bound is picked against the first, and a half-picked range never lands.
  if (isRange) {
    const { from, to } = parseDateRangeRuleValue(currentValue as string | undefined);

    return (
      <div className="flex min-w-0 flex-[3] items-center gap-2">
        {modeSelect}
        <DateRangePicker
          value={{ from: from ?? undefined, to: to ?? undefined }}
          locale={locale}
          triggerClassName="h-9 flex-1"
          onChange={(range) => onChange(`${formatLocalDay(range.from)},${formatLocalDay(range.to)}`)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-[3] items-center gap-2">
      {modeSelect}
      <div className="min-w-0 flex-1">
        <DatePicker
          value={parseDateRuleValue(currentValue as string | undefined)}
          locale={locale}
          triggerClassName="h-9 w-full"
          onChange={(date) => onChange(formatLocalDay(date))}
        />
      </div>
    </div>
  );
};

"use client";

import { useTranslation } from "react-i18next";
import {
  TRelativeDateBound,
  TRelativeDateDirection,
  TRelativeDateUnit,
} from "@formbricks/types/surveys/validation-rules";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ValidationRuleRelativeDateInputProps {
  bound: TRelativeDateBound;
  onChange: (bound: TRelativeDateBound) => void;
}

/**
 * One relative bound: an amount of days, the unit they are counted in, and whether they run
 * before or after the date the survey is answered.
 */
export const ValidationRuleRelativeDateInput = ({
  bound,
  onChange,
}: Readonly<ValidationRuleRelativeDateInputProps>) => {
  const { t } = useTranslation();

  const unitOptions: { value: TRelativeDateUnit; label: string }[] = [
    { value: "calendarDays", label: t("workspace.surveys.edit.validation.calendar_days") },
    { value: "workingDays", label: t("workspace.surveys.edit.validation.working_days") },
  ];

  const directionOptions: { value: TRelativeDateDirection; label: string }[] = [
    { value: "before", label: t("workspace.surveys.edit.validation.before_response") },
    { value: "after", label: t("workspace.surveys.edit.validation.after_response") },
  ];

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Input
        type="number"
        min={0}
        step={1}
        value={bound.amount}
        onChange={(e) => onChange({ ...bound, amount: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
        className="h-9 w-16 shrink-0 bg-white"
        aria-label={t("workspace.surveys.edit.validation.relative_date_amount")}
      />
      <Select
        value={bound.unit}
        onValueChange={(value) => onChange({ ...bound, unit: value as TRelativeDateUnit })}>
        <SelectTrigger
          className="h-9 w-36 shrink-0 bg-white whitespace-nowrap"
          aria-label={t("workspace.surveys.edit.validation.relative_date_unit")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {unitOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={bound.direction}
        onValueChange={(value) => onChange({ ...bound, direction: value as TRelativeDateDirection })}>
        <SelectTrigger
          className="h-9 w-24 shrink-0 bg-white whitespace-nowrap"
          aria-label={t("workspace.surveys.edit.validation.relative_date_direction")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {directionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

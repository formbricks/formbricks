"use client";

import { CalendarCheckIcon } from "lucide-react";
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
 * One relative bound, read left to right as an expression: "Submission day − 3 calendar days".
 * The anchor is a fixed token so the author sees what the offset counts from; the sign stands in
 * for the stored before/after direction and hides at 0, where both directions name the same day.
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

  // Arithmetic signs, not words: "before"/"after" next to "later than"/"earlier than" made the row
  // carry two direction words. The signs are the same in every language, so they are not translated.
  const directionOptions: { value: TRelativeDateDirection; label: string }[] = [
    { value: "before", label: "−" },
    { value: "after", label: "+" },
  ];

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm whitespace-nowrap text-slate-700">
        <CalendarCheckIcon className="size-3.5 text-slate-500" aria-hidden="true" />
        {t("workspace.surveys.edit.validation.relative_anchor_submission_day")}
      </span>
      {bound.amount > 0 ? (
        <Select
          value={bound.direction}
          onValueChange={(value) => onChange({ ...bound, direction: value as TRelativeDateDirection })}>
          <SelectTrigger
            className="h-9 w-16 shrink-0 bg-white whitespace-nowrap"
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
      ) : null}
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
    </div>
  );
};

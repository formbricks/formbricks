"use client";

import { CalendarCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MAX_RELATIVE_DATE_AMOUNT,
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
import { clampRelativeAmount } from "../lib/validation-rules-utils";

interface ValidationRuleRelativeDateInputProps {
  bound: TRelativeDateBound;
  onChange: (bound: TRelativeDateBound) => void;
}

/**
 * One relative bound, read left to right as an expression: "Submission day − 3 calendar days".
 * The anchor is a fixed token so the author sees what the offset counts from; the sign stands in
 * for the stored before/after direction.
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
  // carry two direction words. The signs are the same in every language, so they are not translated;
  // the visually hidden label is what a screen reader gets, since Radix names the option by its text.
  const directionOptions: { value: TRelativeDateDirection; sign: string; label: string }[] = [
    {
      value: "before",
      sign: "−",
      label: t("workspace.surveys.edit.validation.relative_date_direction_before"),
    },
    {
      value: "after",
      sign: "+",
      label: t("workspace.surveys.edit.validation.relative_date_direction_after"),
    },
  ];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-9 min-w-[88px] items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-700">
        <CalendarCheckIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate">
          {t("workspace.surveys.edit.validation.relative_anchor_submission_day")}
        </span>
      </span>
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
              <span aria-hidden="true">{option.sign}</span>
              <span className="sr-only">{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min={0}
        max={MAX_RELATIVE_DATE_AMOUNT}
        step={1}
        value={bound.amount}
        // Clamped to the schema's own bound: without this the field happily takes an amount that
        // ZRelativeDateBound rejects, and the author only finds out when the survey fails to save.
        onChange={(e) => onChange({ ...bound, amount: clampRelativeAmount(e.target.value) })}
        // The field starts at 0, so typing into it would otherwise read "03" until blur.
        onFocus={(e) => e.target.select()}
        // Whole non-negative days only: `e`, signs and `.` make the browser report "" and the field
        // would snap back to 0, losing what was typed.
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
        }}
        className="h-9 w-16 shrink-0 bg-white"
        aria-label={t("workspace.surveys.edit.validation.relative_date_amount")}
      />
      <Select
        value={bound.unit}
        onValueChange={(value) => onChange({ ...bound, unit: value as TRelativeDateUnit })}>
        <SelectTrigger
          className="h-9 w-36 min-w-[96px] bg-white whitespace-nowrap"
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

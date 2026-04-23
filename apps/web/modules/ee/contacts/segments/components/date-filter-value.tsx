"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TDateOperator, TSegmentFilterValue, TTimeUnit } from "@formbricks/types/segment";
import { cn } from "@/lib/cn";
import { dateToUTCISOString, inputValueToDate } from "@/lib/utils/date-input";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface DateFilterValueProps {
  operator: TDateOperator;
  value: TSegmentFilterValue;
  onChange: (value: TSegmentFilterValue) => void;
  viewOnly?: boolean;
}

export function DateFilterValue({ operator, value, onChange, viewOnly }: DateFilterValueProps) {
  const { t } = useTranslation();
  const [error, setError] = useState("");

  // Relative time operators: isOlderThan, isNewerThan
  if (operator === "isOlderThan" || operator === "isNewerThan") {
    const relativeValue =
      typeof value === "object" && "amount" in value && "unit" in value
        ? value
        : { amount: 1, unit: "days" as TTimeUnit };

    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          className={cn("h-9 w-20 bg-white", error && "border border-red-500 focus:border-red-500")}
          disabled={viewOnly}
          value={relativeValue.amount}
          onChange={(e) => {
            const amount = Number.parseInt(e.target.value, 10);
            if (Number.isNaN(amount) || amount < 1) {
              setError(t("environments.segments.value_must_be_positive"));
              return;
            }
            setError("");
            onChange({ amount, unit: relativeValue.unit });
          }}
        />
        <Select
          disabled={viewOnly}
          value={relativeValue.unit}
          onValueChange={(unit: TTimeUnit) => {
            onChange({ amount: relativeValue.amount, unit });
          }}>
          <SelectTrigger className="flex w-auto items-center justify-center bg-white" hideArrow>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">{t("common.days")}</SelectItem>
            <SelectItem value="weeks">{t("common.weeks")}</SelectItem>
            <SelectItem value="months">{t("common.months")}</SelectItem>
            <SelectItem value="years">{t("common.years")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Between operator: needs two date inputs
  if (operator === "isBetween") {
    const betweenValue = Array.isArray(value) && value.length === 2 ? value : ["", ""];

    return (
      <div className="flex items-center gap-2">
        <DatePicker
          date={betweenValue[0] ? inputValueToDate(betweenValue[0].split("T")[0]) : null}
          updateSurveyDate={(date) => onChange([dateToUTCISOString(date), betweenValue[1]])}
          disabled={viewOnly}
          buttonClassName="h-9 w-full min-w-[180px] bg-white"
          className="flex-1"
          placeholder={t("environments.surveys.edit.validation.start_date")}
        />
        <span className="text-sm text-slate-600">{t("common.and")}</span>
        <DatePicker
          date={betweenValue[1] ? inputValueToDate(betweenValue[1].split("T")[0]) : null}
          updateSurveyDate={(date) => onChange([betweenValue[0], dateToUTCISOString(date)])}
          disabled={viewOnly}
          buttonClassName="h-9 w-full min-w-[180px] bg-white"
          className="flex-1"
          placeholder={t("environments.surveys.edit.validation.end_date")}
        />
      </div>
    );
  }

  // Absolute date operators: isBefore, isAfter, isSameDay
  // Use a single date picker
  const dateValue = typeof value === "string" ? value : "";

  return (
    <DatePicker
      date={dateValue ? inputValueToDate(dateValue.split("T")[0]) : null}
      updateSurveyDate={(date) => onChange(dateToUTCISOString(date))}
      disabled={viewOnly}
      buttonClassName="h-9 w-full min-w-[180px] bg-white"
      placeholder={t("common.pick_a_date")}
    />
  );
}

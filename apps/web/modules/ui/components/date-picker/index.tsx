"use client";

import { format } from "date-fns";
import { XIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface DatePickerProps {
  date: Date | null;
  updateSurveyDate: (date: Date) => void;
  minDate?: Date;
  onClearDate?: () => void;
}

export const DatePicker = ({ date, updateSurveyDate, minDate, onClearDate }: DatePickerProps) => {
  const { t } = useTranslation();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      updateSurveyDate(new Date(e.target.value));
    }
  };

  const handleClearDate = () => {
    if (onClearDate) {
      onClearDate();
      if (dateInputRef.current) {
        dateInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="relative flex w-full items-center">
      <div className="relative w-full">
        <input
          ref={dateInputRef}
          type="date"
          min={minDate ? format(minDate, "yyyy-MM-dd") : undefined}
          value={date ? format(date, "yyyy-MM-dd") : ""}
          onChange={handleDateChange}
          placeholder={t("common.pick_a_date")}
          className={cn(
            "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !date && "text-slate-400"
          )}
        />
        {!date && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-slate-400">
            {t("common.pick_a_date")}
          </div>
        )}
      </div>

      {date && onClearDate && (
        <button
          type="button"
          onClick={handleClearDate}
          className="absolute right-3 rounded-sm opacity-50 hover:opacity-100 focus:outline-none">
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

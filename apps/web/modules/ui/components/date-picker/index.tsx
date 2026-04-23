"use client";

import { CalendarCheckIcon, CalendarIcon, XIcon } from "lucide-react";
import { type ComponentProps, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface DatePickerProps {
  date: Date | null;
  updateSurveyDate: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  onClearDate?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

export const DatePicker = ({
  date,
  updateSurveyDate,
  minDate,
  maxDate,
  onClearDate,
  disabled,
  placeholder,
  className,
  buttonClassName,
}: DatePickerProps) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const resolvedLocale = i18n.resolvedLanguage ?? "en-US";

  const selectedDate = useMemo(() => date ?? undefined, [date]);

  const disabledDays = useMemo<ComponentProps<typeof Calendar>["disabled"]>(() => {
    if (disabled) {
      return true;
    }

    const matchers = [] as NonNullable<ComponentProps<typeof Calendar>["disabled"]>[];

    if (minDate) {
      matchers.push({ before: minDate });
    }

    if (maxDate) {
      matchers.push({ after: maxDate });
    }

    return matchers.length > 0 ? (matchers as ComponentProps<typeof Calendar>["disabled"]) : undefined;
  }, [disabled, maxDate, minDate]);

  const formattedDate = useMemo(() => {
    if (!date) return undefined;
    return formatDateForDisplay(date, resolvedLocale);
  }, [date, resolvedLocale]);

  const handleClearDate = () => {
    if (onClearDate) {
      onClearDate();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start border-slate-300 bg-white text-left font-normal text-slate-800 shadow-none hover:bg-slate-50",
              !formattedDate && "text-slate-500",
              buttonClassName
            )}>
            {formattedDate ? <CalendarCheckIcon className="h-4 w-4" /> : <CalendarIcon className="h-4 w-4" />}
            <span>{formattedDate ?? placeholder ?? t("common.pick_a_date")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate ?? minDate ?? new Date()}
            onSelect={(nextDate) => {
              if (!nextDate) return;
              updateSurveyDate(nextDate);
              setIsOpen(false);
            }}
            disabled={disabledDays}
          />
        </PopoverContent>
      </Popover>
      {formattedDate && onClearDate && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handleClearDate}
          className="h-8 w-8 p-0 hover:bg-slate-200">
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

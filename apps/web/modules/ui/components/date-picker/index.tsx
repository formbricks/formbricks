"use client";

import { CalendarCheckIcon, CalendarIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import "./styles.css";

const DEFAULT_LOCALE = "en-US";

const getDisplayDate = (date: Date | null, locale: string): string | undefined => {
  if (!date) {
    return undefined;
  }

  return formatDateForDisplay(date, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getDefaultMinDate = (): Date => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
};

interface DatePickerProps {
  date: Date | null;
  clearButtonId?: string;
  clearButtonLabel?: string;
  locale?: string;
  updateSurveyDate: (date: Date) => void;
  minDate?: Date;
  onClearDate?: () => void;
}

export const DatePicker = ({
  date,
  clearButtonId,
  clearButtonLabel,
  locale = DEFAULT_LOCALE,
  updateSurveyDate,
  minDate,
  onClearDate,
}: DatePickerProps) => {
  const { t } = useTranslation();
  const [value, onChange] = useState<Date | undefined>(date ? new Date(date) : undefined);
  const [formattedDate, setFormattedDate] = useState<string | undefined>(getDisplayDate(date, locale));
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const effectiveMinDate = minDate ?? getDefaultMinDate();

  useEffect(() => {
    const nextValue = date ? new Date(date) : undefined;
    const nextValueTime = nextValue?.getTime();
    const currentValueTime = value?.getTime();

    if (nextValueTime !== currentValueTime) {
      onChange(nextValue);
    }

    setFormattedDate(getDisplayDate(date, locale));
  }, [date, locale, value]);

  const onDateChange = (date: Date) => {
    if (date) {
      updateSurveyDate(date);
      setFormattedDate(getDisplayDate(date, locale));
      onChange(date);
      setIsOpen(false);
    }
  };

  const handleClearDate = () => {
    if (onClearDate) {
      onClearDate();
      setFormattedDate(undefined);
      onChange(undefined);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {formattedDate ? (
            <Button
              variant={"ghost"}
              className={cn(
                "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal",
                !formattedDate && "text-muted-foreground bg-slate-800"
              )}
              ref={btnRef}>
              <CalendarCheckIcon className="mr-2 h-4 w-4" />
              {formattedDate}
            </Button>
          ) : (
            <Button
              variant={"ghost"}
              className={cn(
                "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal",
                !formattedDate && "text-muted-foreground"
              )}
              onClick={() => setIsOpen(true)}
              ref={btnRef}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>{t("common.pick_a_date")}</span>
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="min-w-96 rounded-lg px-4 py-3">
          <Calendar
            locale={locale}
            value={value}
            onChange={(date) => onDateChange(date as Date)}
            minDate={effectiveMinDate}
            className="!border-0"
            tileClassName={({ date }: { date: Date }) => {
              const baseClass =
                "hover:fb-bg-input-bg-selected fb-rounded-custom fb-h-9 fb-p-0 fb-mt-1 fb-font-normal fb-text-heading aria-selected:fb-opacity-100 focus:fb-ring-2 focus:fb-bg-slate-200";
              const today = effectiveMinDate;

              // today's date class
              if (
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear()
              ) {
                return `${baseClass} !fb-bg-brand !fb-border-border-highlight !fb-text-heading focus:fb-ring-2 focus:fb-bg-slate-200`;
              }
              // active date class
              if (
                date.getDate() === value?.getDate() &&
                date.getMonth() === value?.getMonth() &&
                date.getFullYear() === value?.getFullYear()
              ) {
                return `${baseClass} !fb-bg-brand !fb-border-border-highlight !fb-text-heading`;
              }

              return baseClass;
            }}
            showNeighboringMonth={false}
          />
        </PopoverContent>
      </Popover>
      {formattedDate && onClearDate && (
        <Button
          aria-label={clearButtonLabel}
          data-testid={clearButtonId}
          variant="outline"
          size="sm"
          onClick={handleClearDate}
          className="h-8 w-8 p-0 hover:bg-slate-200">
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

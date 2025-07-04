"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useTranslate } from "@tolgee/react";
import { format } from "date-fns";
import { CalendarCheckIcon, CalendarIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import Calendar from "react-calendar";
import "./styles.css";

const getOrdinalSuffix = (day: number) => {
  if (day > 3 && day < 21) return "th"; // 11th, 12th, 13th, etc.
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

interface DatePickerProps {
  date: Date | null;
  updateSurveyDate: (date: Date) => void;
  minDate?: Date;
  onClearDate?: () => void;
}

export const DatePicker = ({ date, updateSurveyDate, minDate, onClearDate }: DatePickerProps) => {
  const { t } = useTranslate();
  const [value, onChange] = useState<Date | undefined>(date ? new Date(date) : undefined);
  const [formattedDate, setFormattedDate] = useState<string | undefined>(
    date ? format(new Date(date), "do MMM, yyyy") : undefined
  );
  const [isOpen, setIsOpen] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);

  const onDateChange = (date: Date) => {
    if (date) {
      updateSurveyDate(date);
      const day = date.getDate();
      const ordinalSuffix = getOrdinalSuffix(day);
      const formatted = format(date, `d'${ordinalSuffix}' MMM, yyyy`);
      setFormattedDate(formatted);
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
                "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal transition-all ease-in hover:bg-slate-300",
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
                "w-[280px] justify-start border border-slate-300 bg-white text-left font-normal hover:bg-slate-300",
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
            value={value}
            onChange={(date) => onDateChange(date as Date)}
            minDate={minDate || new Date()}
            className="!border-0"
            tileClassName={({ date }: { date: Date }) => {
              const baseClass =
                "hover:fb-bg-input-bg-selected fb-rounded-custom fb-h-9 fb-p-0 fb-mt-1 fb-font-normal fb-text-heading aria-selected:fb-opacity-100 focus:fb-ring-2 focus:fb-bg-slate-200";
              // today's date class
              if (
                date.getDate() === new Date().getDate() &&
                date.getMonth() === new Date().getMonth() &&
                date.getFullYear() === new Date().getFullYear()
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
          variant="ghost"
          size="sm"
          onClick={handleClearDate}
          className="h-8 w-8 p-0 hover:bg-slate-200">
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

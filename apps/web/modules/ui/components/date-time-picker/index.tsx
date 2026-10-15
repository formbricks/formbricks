"use client";

import { CalendarClockIcon } from "lucide-react";
import { useId, useState } from "react";
import { type Matcher } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { combineDayAndTime, formatTimeInput, getTimeParts, parseTimeInput } from "./lib/date-time";

export { getEditorTimeZone, validateDateTimeRange, type TDateTimeRangeError } from "./lib/date-time";

const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

interface DateTimePickerProps {
  /** The selected instant, or null for an open bound ("Starts immediately", "No end"). */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** App locale code — pass `i18n.resolvedLanguage ?? i18n.language ?? "en-US"`, never a browser default. */
  locale?: string;
  /** Shown when there is no value, e.g. "Starts immediately". */
  placeholder?: string;
  /** Days before this one can't be picked. */
  minDate?: Date;
  disabled?: boolean;
  id?: string;
  className?: string;
  align?: "start" | "center" | "end";
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Picks a date and a time to the minute, in the editor's own time zone. The trigger follows the
 * kit's outline button; the popover is the kit Calendar plus a typed time field. Range rules
 * (end after start) belong to the form — use `validateDateTimeRange`.
 */
export const DateTimePicker = ({
  value,
  onChange,
  locale,
  placeholder,
  minDate,
  disabled,
  id,
  className,
  align = "start",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: Readonly<DateTimePickerProps>) => {
  const { t } = useTranslation();
  const timeInputId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const label = value ? formatDateTimeForDisplay(value, locale, DISPLAY_OPTIONS) : undefined;
  const disabledDays: Matcher[] | undefined = minDate ? [{ before: minDate }] : undefined;

  const selectDay = (day: Date | undefined) => {
    if (!day) return;
    onChange(combineDayAndTime(day, getTimeParts(value)));
  };

  const changeTime = (raw: string) => {
    const time = parseTimeInput(raw);
    if (!time) return;
    // Typing a time before picking a day schedules it for today.
    onChange(combineDayAndTime(value ?? new Date(), time));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          className={cn(
            "h-10 w-full justify-start bg-white text-left font-normal",
            ariaInvalid && "border-red-500",
            className
          )}>
          <CalendarClockIcon className="size-4 shrink-0 text-slate-500" />
          <span className={cn("truncate", !label && "text-slate-500")}>
            {label ?? placeholder ?? t("common.pick_a_date")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          autoFocus
          mode="single"
          showOutsideDays={false}
          locale={locale}
          defaultMonth={value ?? undefined}
          selected={value ?? undefined}
          disabled={disabledDays}
          onSelect={selectDay}
        />
        <div className="flex items-end gap-2 border-t border-slate-200 p-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={timeInputId} className="text-xs font-medium text-slate-600">
              {t("common.time")}
            </label>
            <Input
              id={timeInputId}
              type="time"
              step={60}
              className="h-9"
              value={value ? formatTimeInput(value) : ""}
              onChange={(event) => changeTime(event.target.value)}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => selectDay(new Date())}>
            {t("common.today")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}>
            {t("common.clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

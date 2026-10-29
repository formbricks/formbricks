"use client";

import { useState } from "react";
import { type Matcher } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import {
  type TTimeParts,
  combineDayAndTime,
  getTimeParts,
  isBeforeDay,
  resolveDefaultDay,
} from "./lib/date-time";
import { TimeField } from "./time-field";

interface DateTimePanelProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  locale?: string;
  minDate?: Date;
  /** The editor's zone, named under the time field; null until the browser has taken over. */
  timeZone: string | null;
  /** Closes the popover. */
  onClose: () => void;
}

/**
 * What the popover holds: the calendar, the time field, Today and Clear. It mounts each time the popover
 * opens, so "today" is read fresh then rather than whenever the page was first rendered.
 */
export const DateTimePanel = ({
  value,
  onChange,
  locale,
  minDate,
  timeZone,
  onClose,
}: Readonly<DateTimePanelProps>) => {
  const { t } = useTranslation();
  const [today] = useState(() => new Date());
  const disabledDays: Matcher[] | undefined = minDate ? [{ before: minDate }] : undefined;

  const selectDay = (day: Date | undefined) => {
    if (!day) return;
    onChange(combineDayAndTime(day, getTimeParts(value)));
  };

  const changeTime = (time: TTimeParts) => {
    // Typing a time before picking a day schedules it for the first day that can be picked.
    onChange(combineDayAndTime(value ?? resolveDefaultDay(today, minDate), time));
  };

  return (
    <>
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
      <div className="space-y-2 border-t border-slate-200 p-3">
        <div className="flex items-start gap-2">
          <TimeField value={value} locale={locale} onTimeChange={changeTime} />
          {/* Lines the buttons up with the time input: its label above is 16px plus a 4px gap. */}
          <div className="mt-5 flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2"
              disabled={isBeforeDay(today, minDate)}
              onClick={() => selectDay(today)}>
              {t("common.today")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2"
              disabled={!value}
              onClick={() => {
                onChange(null);
                onClose();
              }}>
              {t("common.clear")}
            </Button>
          </div>
        </div>
        {timeZone && <p className="text-xs text-slate-500">{t("common.times_in", { timeZone })}</p>}
      </div>
    </>
  );
};

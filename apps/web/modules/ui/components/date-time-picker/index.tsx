"use client";

import { CalendarClockIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { DateTimePanel } from "./date-time-panel";
import { useEditorTimeZone } from "./use-editor-time-zone";

export { getEditorTimeZone, validateDateTimeRange, type TDateTimeRangeError } from "./lib/date-time";
export { useEditorTimeZone } from "./use-editor-time-zone";

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
  /**
   * The field's name for assistive tech, e.g. "Starts". The trigger is read as "<label>: <value>", so
   * the chosen date and time are announced, which a plain `<label htmlFor>` would replace.
   */
  label?: string;
  /** Days before this one can't be picked. */
  minDate?: Date;
  /** The field's error, shown under the trigger in the kit's error style and linked to it. */
  error?: string;
  disabled?: boolean;
  /** Set on the trigger, so a `<label htmlFor>` points at it. */
  id?: string;
  /** The wrapper around the trigger and its error — this is the flex or grid item when one is laid out. */
  className?: string;
  align?: "start" | "center" | "end";
  /** Links the trigger to a field's description, e.g. the "Times in …" note. The error is linked for you. */
  "aria-describedby"?: string;
}

/**
 * Picks a date and a time to the minute, in the editor's own time zone. The trigger follows the
 * kit's outline button; the popover is the kit Calendar plus a typed time field, Today and Clear.
 * Range rules (end after start) belong to the form: validate with `validateDateTimeRange` and hand the
 * message back as `error`.
 */
export const DateTimePicker = ({
  value,
  onChange,
  locale,
  placeholder,
  label,
  minDate,
  error,
  disabled,
  id,
  className,
  align = "start",
  "aria-describedby": ariaDescribedBy,
}: Readonly<DateTimePickerProps>) => {
  const { t } = useTranslation();
  const errorId = useId();
  const timeZone = useEditorTimeZone();
  const [isOpen, setIsOpen] = useState(false);

  // The server's zone isn't the editor's, so a value is only written out once the browser has taken over.
  const valueText = value && timeZone ? formatDateTimeForDisplay(value, locale, DISPLAY_OPTIONS) : "";
  const triggerText = value ? valueText : (placeholder ?? t("common.pick_a_date_and_time"));
  const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label ? `${label}: ${triggerText}` : undefined}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-10 w-full justify-start bg-white text-left font-normal",
              error && "border-red-500"
            )}>
            <CalendarClockIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className={cn("truncate", !value && "text-slate-500")}>{triggerText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align} aria-label={t("common.pick_a_date_and_time")}>
          <DateTimePanel
            value={value}
            onChange={onChange}
            locale={locale}
            minDate={minDate}
            timeZone={timeZone}
            onClose={() => setIsOpen(false)}
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
};

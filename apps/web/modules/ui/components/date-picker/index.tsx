"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { type Matcher } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { Calendar } from "@/modules/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { type TDateRangeBound, type TDateRangeValue, applyRangeClick, applyRangeHover } from "./lib/range";

export type { TDateRangeValue } from "./lib/range";

const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** `disabled` matchers for react-day-picker, built from the optional bounds. */
const getDisabledMatchers = (minDate?: Date, maxDate?: Date): Matcher[] | undefined => {
  const matchers: Matcher[] = [];
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });
  return matchers.length > 0 ? matchers : undefined;
};

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  /** App locale code — pass `i18n.resolvedLanguage ?? i18n.language ?? "en-US"`, never a browser default. */
  locale?: string;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  /** The wrapper around trigger and clear button — this is the flex item when one is laid out. */
  className?: string;
  align?: "start" | "center" | "end";
  /** Renders a clear button next to the trigger. */
  onClear?: () => void;
  clearButtonId?: string;
  clearButtonLabel?: string;
}

export const DatePicker = ({
  value,
  onChange,
  locale,
  minDate,
  maxDate,
  placeholder,
  disabled,
  triggerClassName,
  className,
  align = "start",
  onClear,
  clearButtonId,
  clearButtonLabel,
}: Readonly<DatePickerProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const label = value ? formatDateForDisplay(value, locale, DISPLAY_OPTIONS) : undefined;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-[280px] justify-start bg-white text-left font-normal", triggerClassName)}>
            <CalendarIcon className="mr-2 size-4 shrink-0" />
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
            disabled={getDisabledMatchers(minDate, maxDate)}
            onSelect={(date) => {
              if (!date) return;
              onChange(date);
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && onClear && (
        <Button
          type="button"
          aria-label={clearButtonLabel ?? t("common.clear_date")}
          data-testid={clearButtonId}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onClear}
          className="size-8 shrink-0 p-0">
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
  );
};

interface DateRangeCalendarProps {
  value: TDateRangeValue;
  onChange: (range: TDateRangeValue) => void;
  /**
   * Fires once the second bound lands, carrying the committed range. It is passed explicitly rather
   * than read back from `value`, which is still the pre-click range while this fires.
   */
  onComplete?: (range: TDateRangeValue) => void;
  locale?: string;
  minDate?: Date;
  maxDate?: Date;
  numberOfMonths?: number;
  className?: string;
}

/**
 * The range calendar without a trigger, for hosts that already own the open/close affordance (the
 * responses filter opens it from its own dropdown).
 *
 * Which bound the next click sets is component state and resets on mount, so a host that mounts this
 * conditionally always starts a fresh range at `from`.
 */
export const DateRangeCalendar = ({
  value,
  onChange,
  onComplete,
  locale,
  minDate,
  maxDate,
  numberOfMonths = 2,
  className,
}: Readonly<DateRangeCalendarProps>) => {
  const [bound, setBound] = useState<TDateRangeBound>("from");
  const [hoveredRange, setHoveredRange] = useState<TDateRangeValue | null>(null);

  return (
    <Calendar
      autoFocus
      mode="range"
      showOutsideDays={false}
      locale={locale}
      className={className}
      numberOfMonths={numberOfMonths}
      defaultMonth={value.from}
      // The hovered preview stands in for the committed range so the interval grows under the pointer
      // before the second click commits it.
      selected={hoveredRange ?? value}
      disabled={getDisabledMatchers(minDate, maxDate)}
      // `onSelect` has to be here even though the new range is ignored: `useRange` reads `selected` as
      // an *initial* value and keeps its own internal range unless an `onSelect` is passed
      // (`selected = !onSelect ? internallySelected : initiallySelected`). Without it the calendar
      // renders the range modifiers off its own stale state, so the interval never paints. The
      // trigger date is what matters — the bounds come from `applyRangeClick`, which pins whole local
      // days and refuses to invert, neither of which react-day-picker's own `addToRange` does.
      onSelect={(_range, triggerDate) => {
        const { range, nextBound, isComplete } = applyRangeClick(value, bound, triggerDate);
        onChange(range);
        setBound(nextBound);
        setHoveredRange(null);
        if (isComplete) onComplete?.(range);
      }}
      onDayMouseEnter={(date) => setHoveredRange(applyRangeHover(value, bound, date))}
      onDayMouseLeave={() => setHoveredRange(null)}
    />
  );
};

interface DateRangePickerProps {
  value: TDateRangeValue | null;
  /** Fires only for a complete range, so a half-picked one never reaches a query. */
  onChange: (range: { from: Date; to: Date }) => void;
  locale?: string;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}

export const DateRangePicker = ({
  value,
  onChange,
  locale,
  minDate,
  maxDate,
  placeholder,
  disabled,
  triggerClassName,
  align = "start",
}: Readonly<DateRangePickerProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<TDateRangeValue>({ from: value?.from, to: value?.to });

  const label = useMemo(() => {
    if (!value?.from || !value.to) return undefined;
    return `${formatDateForDisplay(value.from, locale, DISPLAY_OPTIONS)} – ${formatDateForDisplay(value.to, locale, DISPLAY_OPTIONS)}`;
  }, [value?.from, value?.to, locale]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        // Reopening starts from the committed value, not from a range abandoned half-picked last time.
        if (next) setDraft({ from: value?.from, to: value?.to });
        setIsOpen(next);
      }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("justify-start bg-white text-left font-normal", triggerClassName)}>
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className={cn("truncate", !label && "text-slate-500")}>
            {label ?? placeholder ?? t("common.pick_a_date_range")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <DateRangeCalendar
          value={draft}
          locale={locale}
          minDate={minDate}
          maxDate={maxDate}
          onChange={setDraft}
          onComplete={(range) => {
            if (!range.from || !range.to) return;
            onChange({ from: range.from, to: range.to });
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

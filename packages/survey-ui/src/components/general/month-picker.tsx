import { type Locale, format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import { getDateFnsLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  /** Currently selected date (only year and month are used) */
  selected?: Date;
  /** Callback when a month is selected — date is set to the 1st of that month */
  onSelect: (date: Date | undefined) => void;
  /** Locale code for month names (e.g., "en-US", "de-DE") */
  locale?: Locale | string;
  /** Earliest selectable month */
  startMonth?: Date;
  /** Latest selectable month */
  endMonth?: Date;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether a selection is required */
  required?: boolean;
  /** Additional class names */
  className?: string;
}

function MonthPicker({
  selected,
  onSelect,
  locale,
  startMonth,
  endMonth,
  disabled = false,
  className,
}: Readonly<MonthPickerProps>): React.JSX.Element {
  const [displayYear, setDisplayYear] = React.useState(() => {
    if (selected) return selected.getFullYear();
    return new Date().getFullYear();
  });

  // Sync display year when selected changes
  React.useEffect(() => {
    if (selected) {
      setDisplayYear(selected.getFullYear());
    }
  }, [selected]);

  const resolvedLocale = React.useMemo(() => {
    if (!locale) return undefined;
    if (typeof locale === "string") return getDateFnsLocale(locale);
    return locale;
  }, [locale]);

  const minYear = startMonth ? startMonth.getFullYear() : displayYear - 100;
  const maxYear = endMonth ? endMonth.getFullYear() : displayYear + 100;

  const canGoPrev = displayYear > minYear;
  const canGoNext = displayYear < maxYear;

  const isMonthDisabled = (monthIndex: number): boolean => {
    if (disabled) return true;
    if (startMonth && (displayYear < startMonth.getFullYear() || (displayYear === startMonth.getFullYear() && monthIndex < startMonth.getMonth()))) {
      return true;
    }
    if (endMonth && (displayYear > endMonth.getFullYear() || (displayYear === endMonth.getFullYear() && monthIndex > endMonth.getMonth()))) {
      return true;
    }
    return false;
  };

  const isMonthSelected = (monthIndex: number): boolean => {
    return !!selected && selected.getFullYear() === displayYear && selected.getMonth() === monthIndex;
  };

  const handleMonthClick = (monthIndex: number): void => {
    if (isMonthDisabled(monthIndex)) return;
    const newDate = new Date(displayYear, monthIndex, 1);
    onSelect(newDate);
  };

  const getMonthName = (monthIndex: number): string => {
    const date = new Date(displayYear, monthIndex, 1);
    if (resolvedLocale) {
      return format(date, "MMM", { locale: resolvedLocale });
    }
    return date.toLocaleString("default", { month: "short" });
  };

  return (
    <div
      className={cn(
        "rounded-input border-input-border bg-input-bg text-input-text shadow-input mx-auto w-full max-w-[25rem] border p-3",
        className
      )}>
      {/* Year navigation */}
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoPrev}
          onClick={() => setDisplayYear((y) => y - 1)}
          type="button"
          aria-label="Previous year">
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="select-none text-sm font-medium">{displayYear}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canGoNext}
          onClick={() => setDisplayYear((y) => y + 1)}
          type="button"
          aria-label="Next year">
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const isSelected = isMonthSelected(i);
          const isDisabled = isMonthDisabled(i);
          return (
            <Button
              key={i}
              variant="ghost"
              type="button"
              disabled={isDisabled}
              onClick={() => handleMonthClick(i)}
              className={cn(
                "h-10 w-full text-sm font-normal",
                isSelected && "bg-brand text-primary-foreground hover:bg-[color-mix(in_srgb,var(--fb-survey-brand-color)_70%,transparent)]",
                !isSelected && !isDisabled && "hover:bg-[color-mix(in_srgb,var(--fb-survey-brand-color)_70%,transparent)]"
              )}>
              {getMonthName(i)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export { MonthPicker };
export type { MonthPickerProps };

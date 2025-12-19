import * as React from "react";
import { Calendar } from "@/components/general/calendar";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { getDateFnsLocale } from "@/lib/locale";

interface DateElementProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the date input */
  inputId: string;
  /** Current date value in ISO format (YYYY-MM-DD) */
  value?: string;
  /** Callback function called when the date value changes */
  onChange: (value: string) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Minimum date allowed (ISO format: YYYY-MM-DD) */
  minDate?: string;
  /** Maximum date allowed (ISO format: YYYY-MM-DD) */
  maxDate?: string;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the date input is disabled */
  disabled?: boolean;
  /** Locale code for date formatting (e.g., "en-US", "de-DE", "fr-FR"). Defaults to browser locale or "en-US" */
  locale?: string;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

function DateElement({
  elementId,
  headline,
  description,
  inputId,
  value,
  onChange,
  required = false,
  minDate,
  maxDate,
  dir = "auto",
  disabled = false,
  locale = "en-US",
  errorMessage,
  imageUrl,
  videoUrl,
}: Readonly<DateElementProps>): React.JSX.Element {
  // Initialize date from value string, parsing as local time to avoid timezone issues
  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined;
    // Parse YYYY-MM-DD format as local date (not UTC)
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  });

  // Sync date state when value prop changes
  React.useEffect(() => {
    if (value) {
      // Parse YYYY-MM-DD format as local date (not UTC)
      const [year, month, day] = value.split("-").map(Number);
      const newDate = new Date(year, month - 1, day);
      setDate((prevDate) => {
        // Only update if the date actually changed to avoid unnecessary re-renders
        if (!prevDate || newDate.getTime() !== prevDate.getTime()) {
          return newDate;
        }
        return prevDate;
      });
    } else {
      setDate(undefined);
    }
  }, [value]);

  // Convert Date to ISO string (YYYY-MM-DD) when date changes
  const handleDateSelect = (selectedDate: Date | undefined): void => {
    setDate(selectedDate);
    if (selectedDate) {
      // Convert to ISO format (YYYY-MM-DD) using local time to avoid timezone issues
      const year = String(selectedDate.getFullYear());
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const isoString = `${year}-${month}-${day}`;
      onChange(isoString);
    } else {
      onChange("");
    }
  };

  // Get locale for date formatting
  const dateLocale = React.useMemo(() => {
    return locale ? getDateFnsLocale(locale) : undefined;
  }, [locale]);

  const startMonth = React.useMemo(() => {
    if (!minDate) return undefined;
    try {
      const [year, month, day] = minDate.split("-").map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return undefined;
    }
  }, [minDate]);

  const endMonth = React.useMemo(() => {
    if (!maxDate) return undefined;
    try {
      const [year, month, day] = maxDate.split("-").map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return undefined;
    }
  }, [maxDate]);

  // Create disabled function for date restrictions
  const isDateDisabled = React.useCallback(
    (dateToCheck: Date): boolean => {
      if (disabled) return true;

      const checkAtMidnight = new Date(
        dateToCheck.getFullYear(),
        dateToCheck.getMonth(),
        dateToCheck.getDate()
      );

      if (startMonth) {
        const minAtMidnight = new Date(startMonth.getFullYear(), startMonth.getMonth(), startMonth.getDate());
        if (checkAtMidnight < minAtMidnight) return true;
      }

      if (endMonth) {
        const maxAtMidnight = new Date(endMonth.getFullYear(), endMonth.getMonth(), endMonth.getDate());
        if (checkAtMidnight > maxAtMidnight) return true;
      }
      return false;
    },
    [disabled, endMonth, startMonth]
  );

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />
        {/* Calendar - Always visible */}
        <div className="w-full">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={isDateDisabled}
            onSelect={handleDateSelect}
            locale={dateLocale}
            required={required}
            className="rounded-input border-input-border bg-input-bg text-input-text shadow-input mx-auto w-full max-w-[25rem] border"
          />
        </div>
      </div>
    </div>
  );
}

export { DateElement };
export type { DateElementProps };

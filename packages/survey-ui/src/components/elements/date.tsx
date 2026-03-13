import * as React from "react";
import {
  DATE_FORMAT_OUTPUT_ORDER,
  DATE_FORMAT_PARSE_ORDER,
  DEFAULT_DATE_STORAGE_FORMAT,
  type TSurveyDateStorageFormat,
} from "@formbricks/types/surveys/date-formats";
import { Calendar } from "@/components/general/calendar";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { getDateFnsLocale } from "@/lib/locale";

export type DateStorageFormat = TSurveyDateStorageFormat;

const ISO_FIRST_CHARS = /^\d{4}/;

function parseValueToDate(value: string, format: DateStorageFormat): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split("-");
  if (parts.length !== 3) return undefined;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some(Number.isNaN)) return undefined;
  const useIso = ISO_FIRST_CHARS.test(trimmed);
  const effective = useIso ? DEFAULT_DATE_STORAGE_FORMAT : format;
  const order = DATE_FORMAT_PARSE_ORDER[effective];
  const year = nums[order.yearIdx];
  const month = nums[order.monthIdx];
  const day = nums[order.dayIdx];
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return undefined;
  return date;
}

function formatDateForStorage(year: string, month: string, day: string, format: DateStorageFormat): string {
  const comps = [year, month, day];
  const [i, j, k] = DATE_FORMAT_OUTPUT_ORDER[format];
  return `${comps[i]}-${comps[j]}-${comps[k]}`;
}

interface DateElementProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the date input */
  inputId: string;
  /** Current date value (format depends on outputFormat; legacy is often YYYY-MM-DD) */
  value?: string;
  /** Callback function called when the date value changes */
  onChange: (value: string) => void;
  /** Format for the value passed to onChange (default y-M-d = ISO) */
  outputFormat?: DateStorageFormat;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
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
  outputFormat = DEFAULT_DATE_STORAGE_FORMAT,
  required = false,
  requiredLabel,
  minDate,
  maxDate,
  dir = "auto",
  disabled = false,
  locale = "en-US",
  errorMessage,
  imageUrl,
  videoUrl,
}: Readonly<DateElementProps>): React.JSX.Element {
  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined;
    return parseValueToDate(value, outputFormat);
  });

  React.useEffect(() => {
    if (!value) {
      setDate(undefined);
      return;
    }
    const newDate = parseValueToDate(value, outputFormat);
    setDate((prevDate) => {
      if (!newDate) return undefined;
      if (prevDate?.getTime() !== newDate.getTime()) return newDate;
      return prevDate;
    });
  }, [value, outputFormat]);

  const handleDateSelect = (selectedDate: Date | undefined): void => {
    setDate(selectedDate);
    if (selectedDate) {
      const year = String(selectedDate.getFullYear());
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      onChange(formatDateForStorage(year, month, day, outputFormat));
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
        requiredLabel={requiredLabel}
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
            className="rounded-input border-input-border bg-input-bg text-input-text shadow-input mx-auto h-[stretch] w-full max-w-[25rem] border"
          />
        </div>
      </div>
    </div>
  );
}

export { DateElement };
export type { DateElementProps };

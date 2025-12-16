import { type Locale } from "date-fns";
import { enUS } from "date-fns/locale";
import * as React from "react";
import { Calendar } from "@/components/general/calendar";
import { ElementHeader } from "@/components/general/element-header";

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
  /** Locale object for date formatting. Defaults to en-US if not provided */
  dateHtmlLocale?: Locale;
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
  dateHtmlLocale = enUS,
}: DateElementProps): React.JSX.Element {
  const [date, setDate] = React.useState<Date | undefined>(value ? new Date(value) : undefined);

  // Convert Date to ISO string (YYYY-MM-DD) when date changes
  const handleDateSelect = (selectedDate: Date | undefined): void => {
    setDate(selectedDate);
    if (selectedDate) {
      // Convert to ISO format (YYYY-MM-DD)
      const isoString = selectedDate.toISOString().split("T")[0];
      onChange(isoString);
    } else {
      onChange("");
    }
  };

  // Convert minDate/maxDate strings to Date objects
  const minDateObj = minDate ? new Date(minDate) : undefined;
  const maxDateObj = maxDate ? new Date(maxDate) : undefined;

  // Create disabled function for date restrictions
  const isDateDisabled = React.useCallback(
    (dateToCheck: Date): boolean => {
      if (disabled) return true;
      if (minDateObj) {
        const minAtMidnight = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());
        const checkAtMidnight = new Date(
          dateToCheck.getFullYear(),
          dateToCheck.getMonth(),
          dateToCheck.getDate()
        );
        if (checkAtMidnight < minAtMidnight) return true;
      }
      if (maxDateObj) {
        const maxAtMidnight = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), maxDateObj.getDate());
        const checkAtMidnight = new Date(
          dateToCheck.getFullYear(),
          dateToCheck.getMonth(),
          dateToCheck.getDate()
        );
        if (checkAtMidnight > maxAtMidnight) return true;
      }
      return false;
    },
    [disabled, minDateObj, maxDateObj]
  );

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Calendar - Always visible */}
      <div className="w-full">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          disabled={isDateDisabled}
          onSelect={handleDateSelect}
          fromYear={minDateObj?.getFullYear() ?? 1900}
          toYear={maxDateObj?.getFullYear() ?? 2100}
          locale={dateHtmlLocale}
          className="rounded-input border-input-border bg-input-bg text-input-text shadow-input w-full border"
          classNames={{
            root: "w-full",
          }}
        />
      </div>
    </div>
  );
}

export { DateElement };
export type { DateElementProps };

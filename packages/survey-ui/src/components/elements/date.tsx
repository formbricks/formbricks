import * as React from "react";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { useTextDirection } from "@/hooks/use-text-direction";

interface DateQuestionProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
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
}

function DateQuestion({
  elementId,
  headline,
  description,
  inputId,
  value,
  onChange,
  required = false,
  minDate,
  maxDate,
  errorMessage,
  dir = "auto",
  disabled = false,
}: DateQuestionProps): React.JSX.Element {
  // Ensure value is always a string or undefined
  const currentValue = value ?? "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? ""],
  });

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Date Input */}
      <div className="space-y-1">
        <Input
          id={inputId}
          type="date"
          value={currentValue}
          onChange={handleChange}
          required={required}
          dir={detectedDir}
          disabled={disabled}
          errorMessage={errorMessage}
          min={minDate}
          max={maxDate}
        />
      </div>
    </div>
  );
}

export { DateQuestion };
export type { DateQuestionProps };

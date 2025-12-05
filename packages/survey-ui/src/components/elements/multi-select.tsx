import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { Checkbox } from "../general/checkbox";
import { ElementHeader } from "../general/element-header";

/**
 * Option for multi-select question
 */
export interface MultiSelectOption {
  /** Unique identifier for the option */
  id: string;
  /** Display label for the option */
  label: string;
}

interface MultiSelectProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the multi-select group */
  inputId: string;
  /** Array of options to choose from */
  options: MultiSelectOption[];
  /** Currently selected option IDs */
  value?: string[];
  /** Callback function called when selection changes */
  onChange: (value: string[]) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display below the options */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the options are disabled */
  disabled?: boolean;
}

function MultiSelect({
  elementId,
  headline,
  description,
  inputId,
  options,
  value = [],
  onChange,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: MultiSelectProps): React.JSX.Element {
  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];

  const handleOptionChange = (optionId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, optionId]);
    } else {
      onChange(selectedValues.filter((id) => id !== optionId));
    }
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? "", ...options.map((opt) => opt.label)],
  });

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Options */}
      <div className="space-y-3">
        {errorMessage && (
          <div className="text-destructive flex items-center gap-1 text-sm" dir={detectedDir}>
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="space-y-3" role="group" aria-labelledby={inputId}>
          {options.map((option) => {
            const isChecked = selectedValues.includes(option.id);
            const optionId = `${inputId}-${option.id}`;

            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md transition-colors",
                  disabled && "cursor-not-allowed opacity-50"
                )}>
                <Checkbox
                  id={optionId}
                  checked={isChecked}
                  onCheckedChange={(checked) => handleOptionChange(option.id, checked === true)}
                  disabled={disabled}
                  aria-invalid={Boolean(errorMessage)}
                />
                <span
                  className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                  style={{
                    fontFamily: "var(--fb-option-label-font-family, inherit)",
                    fontSize: "var(--fb-option-label-font-size, 0.875rem)",
                    fontWeight:
                      "var(--fb-option-label-font-weight, 400)" as React.CSSProperties["fontWeight"],
                    color: "var(--fb-option-label-color, currentColor)",
                  }}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { MultiSelect };
export type { MultiSelectProps };

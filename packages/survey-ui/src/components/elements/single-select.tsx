import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { ElementHeader } from "../general/element-header";
import { RadioGroup, RadioGroupItem } from "../general/radio-group";

/**
 * Option for single-select question
 */
export interface SingleSelectOption {
  /** Unique identifier for the option */
  id: string;
  /** Display label for the option */
  label: string;
}

interface SingleSelectProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the single-select group */
  inputId: string;
  /** Array of options to choose from */
  options: SingleSelectOption[];
  /** Currently selected option ID */
  value?: string;
  /** Callback function called when selection changes */
  onChange: (value: string) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display below the options */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the options are disabled */
  disabled?: boolean;
}

function SingleSelect({
  elementId,
  headline,
  description,
  inputId,
  options,
  value,
  onChange,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: SingleSelectProps): React.JSX.Element {
  // Ensure value is always a string or undefined
  const selectedValue = value ?? undefined;

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
      <RadioGroup
        value={selectedValue}
        onValueChange={onChange}
        disabled={disabled}
        errorMessage={errorMessage}
        dir={detectedDir}
        className="space-y-2">
        {options.map((option) => {
          const optionId = `${inputId}-${option.id}`;

          return (
            <label
              key={option.id}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md transition-colors",
                disabled && "cursor-not-allowed opacity-50"
              )}>
              <RadioGroupItem value={option.id} id={optionId} disabled={disabled} />
              <span
                className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                style={{
                  fontFamily: "var(--fb-option-label-font-family, inherit)",
                  fontSize: "var(--fb-option-label-font-size, 0.875rem)",
                  fontWeight: "var(--fb-option-label-font-weight, 400)" as React.CSSProperties["fontWeight"],
                  color: "var(--fb-option-label-color, currentColor)",
                }}>
                {option.label}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

export { SingleSelect };
export type { SingleSelectProps };

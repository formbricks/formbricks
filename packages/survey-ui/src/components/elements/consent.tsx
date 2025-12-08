import * as React from "react";
import { Checkbox } from "@/components/general/checkbox";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { useTextDirection } from "@/hooks/use-text-direction";
import { cn } from "@/lib/utils";

/**
 * Props for the Consent question component
 */
export interface ConsentProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the consent checkbox */
  inputId: string;
  /** Label text for the consent checkbox */
  checkboxLabel: string;
  /** Whether consent is checked */
  value?: boolean;
  /** Callback function called when consent changes */
  onChange: (checked: boolean) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the checkbox is disabled */
  disabled?: boolean;
}

function Consent({
  elementId,
  headline,
  description,
  inputId,
  checkboxLabel,
  value = false,
  onChange,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: ConsentProps): React.JSX.Element {
  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? "", checkboxLabel],
  });

  const handleCheckboxChange = (checked: boolean) => {
    if (disabled) return;
    onChange(checked);
  };

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Consent Checkbox */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={detectedDir} />

        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors",
            "hover:bg-accent focus-within:border-primary focus-within:bg-accent focus-within:shadow-sm",
            errorMessage && "border-destructive",
            disabled && "cursor-not-allowed opacity-50"
          )}
          dir={detectedDir}>
          <Checkbox
            id={inputId}
            checked={value}
            onCheckedChange={handleCheckboxChange}
            disabled={disabled}
            aria-invalid={Boolean(errorMessage)}
            aria-required={required}
          />
          <span className="flex-1 text-sm font-medium leading-none" dir={detectedDir}>
            {checkboxLabel}
          </span>
        </label>
      </div>
    </div>
  );
}

export { Consent };

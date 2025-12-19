import * as React from "react";
import { Checkbox } from "@/components/general/checkbox";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { cn } from "@/lib/utils";

/**
 * Props for the Consent element component
 */
export interface ConsentProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
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
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
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
  imageUrl,
  videoUrl,
}: Readonly<ConsentProps>): React.JSX.Element {
  const handleCheckboxChange = (checked: boolean): void => {
    if (disabled) return;
    onChange(checked);
  };

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

      {/* Consent Checkbox */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={dir} />

        <label
          htmlFor={`${inputId}-checkbox`}
          className={cn(
            "bg-input-bg border-input-border text-input-text w-input px-input-x py-input-y rounded-input flex cursor-pointer items-center gap-3 border p-4 transition-colors",
            "focus-within:border-ring focus-within:ring-ring/50 font-fontWeight focus-within:shadow-sm",
            errorMessage && "border-destructive",
            disabled && "cursor-not-allowed opacity-50"
          )}
          dir={dir}>
          <Checkbox
            id={`${inputId}-checkbox`}
            checked={value}
            onCheckedChange={handleCheckboxChange}
            disabled={disabled}
            aria-invalid={Boolean(errorMessage)}
            required={required}
          />
          {/* need to use style here because tailwind is not able to use css variables for font size and weight */}
          <span
            className="font-input-weight text-input-text flex-1"
            style={{ fontSize: "var(--fb-input-font-size)" }}
            dir={dir}>
            {checkboxLabel}
          </span>
        </label>
      </div>
    </div>
  );
}

export { Consent };

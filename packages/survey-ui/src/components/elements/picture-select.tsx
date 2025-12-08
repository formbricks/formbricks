import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { Checkbox } from "../general/checkbox";
import { ElementHeader } from "../general/element-header";
import { RadioGroupItem } from "../general/radio-group";

/**
 * Picture option for picture select question
 */
export interface PictureSelectOption {
  /** Unique identifier for the option */
  id: string;
  /** URL of the image */
  imageUrl: string;
  /** Alt text for the image */
  alt?: string;
}

interface PictureSelectProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the picture select group */
  inputId: string;
  /** Array of picture options to choose from */
  options: PictureSelectOption[];
  /** Currently selected option ID(s) - string for single select, string[] for multi select */
  value?: string | string[];
  /** Callback function called when selection changes */
  onChange: (value: string | string[]) => void;
  /** Whether multiple selections are allowed */
  allowMulti?: boolean;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the options are disabled */
  disabled?: boolean;
}

function PictureSelect({
  elementId,
  headline,
  description,
  inputId,
  options,
  value,
  onChange,
  allowMulti = false,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: PictureSelectProps): React.JSX.Element {
  // Ensure value is always the correct type
  const selectedValues = allowMulti
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === "string"
      ? value
      : undefined;

  const handleOptionChange = (optionId: string) => {
    if (disabled) return;

    if (allowMulti) {
      const currentArray = Array.isArray(value) ? value : [];
      const newValue = currentArray.includes(optionId)
        ? currentArray.filter((id) => id !== optionId)
        : [...currentArray, optionId];
      onChange(newValue);
    } else {
      // Single select - toggle if same option, otherwise select new one
      const newValue = selectedValues === optionId ? undefined : optionId;
      onChange(newValue ?? "");
    }
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? "", ...options.map((opt) => opt.alt ?? "")],
  });

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Error message */}
      {errorMessage && (
        <div className="text-destructive flex items-center gap-1 text-sm" dir={detectedDir}>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Picture Grid - 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const optionId = `${inputId}-${option.id}`;
          const isSelected = allowMulti
            ? (selectedValues as string[]).includes(option.id)
            : selectedValues === option.id;

          return (
            <div
              key={option.id}
              className={cn(
                "relative aspect-[162/97] w-full cursor-pointer transition-all",
                disabled && "cursor-not-allowed opacity-50"
              )}
              style={{
                backgroundColor: "var(--fb-input-bg-color)",
                borderRadius: "5px",
              }}
              onClick={() => handleOptionChange(option.id)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !disabled) {
                  e.preventDefault();
                  handleOptionChange(option.id);
                }
              }}
              aria-pressed={isSelected}
              aria-disabled={disabled}>
              {/* Image container with border when selected */}
              <div
                className={cn(
                  "absolute inset-[2px] overflow-hidden rounded-[5px]",
                  isSelected && "border-4 border-solid"
                )}
                style={{
                  borderColor: isSelected ? "var(--fb-input-color)" : "transparent",
                }}>
                <img
                  src={option.imageUrl}
                  alt={option.alt ?? `Option ${option.id}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Selection indicator - Radio button for single select, Checkbox for multi select */}
              {allowMulti ? (
                <div className="absolute right-[5%] top-[5%]">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleOptionChange(option.id)}
                    disabled={disabled}
                    className="h-4 w-4"
                    aria-label={option.alt ?? `Select ${option.id}`}
                  />
                </div>
              ) : (
                <div className="absolute right-[5%] top-[5%]">
                  <RadioGroupPrimitive.Root value={isSelected ? option.id : undefined} className="contents">
                    <RadioGroupItem
                      value={option.id}
                      id={optionId}
                      disabled={disabled}
                      className="h-4 w-4 bg-white"
                      aria-label={option.alt ?? `Select ${option.id}`}
                    />
                  </RadioGroupPrimitive.Root>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PictureSelect };
export type { PictureSelectProps };

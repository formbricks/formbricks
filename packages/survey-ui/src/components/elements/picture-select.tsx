import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";
import { Checkbox } from "@/components/general/checkbox";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { RadioGroupItem } from "@/components/general/radio-group";
import { cn } from "@/lib/utils";

/**
 * Picture option for picture select element
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
  /** The main element or prompt text displayed as the headline */
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
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
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
  imageUrl,
  videoUrl,
}: Readonly<PictureSelectProps>): React.JSX.Element {
  // Ensure value is always the correct type
  let selectedValues: string[] | string | undefined;
  if (allowMulti) {
    selectedValues = Array.isArray(value) ? value : [];
  } else {
    selectedValues = typeof value === "string" ? value : undefined;
  }

  const handleMultiSelectChange = (optionId: string, checked: boolean): void => {
    if (disabled) return;

    const currentArray = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentArray, optionId]);
    } else {
      onChange(currentArray.filter((id) => id !== optionId));
    }
  };

  const handleSingleSelectChange = (newValue: string): void => {
    if (disabled) return;
    onChange(newValue);
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

      {/* Picture Grid - 2 columns */}
      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />
        {allowMulti ? (
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const isSelected = (selectedValues as string[]).includes(option.id);
              const optionId = `${inputId}-${option.id}`;

              return (
                <label
                  key={option.id}
                  htmlFor={optionId}
                  className={cn(
                    "rounded-option relative aspect-[162/97] w-full cursor-pointer transition-all",
                    disabled && "cursor-not-allowed opacity-50"
                  )}>
                  {/* Image container with border when selected */}
                  <div
                    className={cn(
                      "rounded-option absolute inset-[2px] overflow-hidden",
                      isSelected && "border-brand border-4 border-solid"
                    )}>
                    <img
                      src={option.imageUrl}
                      alt={option.alt ?? `Option ${option.id}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {/* Selection indicator - Checkbox for multi select */}
                  <div
                    className="absolute top-[5%] right-[5%]"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}>
                    <Checkbox
                      id={optionId}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        handleMultiSelectChange(option.id, checked === true);
                      }}
                      disabled={disabled}
                      className="h-4 w-4"
                      aria-label={option.alt ?? `Select ${option.id}`}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <RadioGroupPrimitive.Root
            value={selectedValues as string}
            onValueChange={handleSingleSelectChange}
            disabled={disabled}
            className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const optionId = `${inputId}-${option.id}`;
              const isSelected = selectedValues === option.id;

              return (
                <label
                  key={option.id}
                  htmlFor={optionId}
                  className={cn(
                    "rounded-option relative aspect-[162/97] w-full cursor-pointer transition-all",
                    disabled && "cursor-not-allowed opacity-50"
                  )}>
                  {/* Image container with border when selected */}
                  <div
                    className={cn(
                      "rounded-option absolute inset-[2px] overflow-hidden",
                      isSelected && "border-brand border-4 border-solid"
                    )}>
                    <img
                      src={option.imageUrl}
                      alt={option.alt ?? `Option ${option.id}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {/* Selection indicator - Radio button for single select */}
                  <div
                    className="absolute top-[5%] right-[5%]"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}>
                    <RadioGroupItem
                      value={option.id}
                      id={optionId}
                      disabled={disabled}
                      className="h-4 w-4 bg-white"
                      aria-label={option.alt ?? `Select ${option.id}`}
                    />
                  </div>
                </label>
              );
            })}
          </RadioGroupPrimitive.Root>
        )}
      </div>
    </div>
  );
}

export { PictureSelect };
export type { PictureSelectProps };

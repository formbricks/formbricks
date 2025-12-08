import { ChevronDown } from "lucide-react";
import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { Button } from "../general/button";
import { Checkbox } from "../general/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../general/dropdown-menu";
import { ElementError } from "../general/element-error";
import { ElementHeader } from "../general/element-header";
import { Input } from "../general/input";
import { Label } from "../general/label";

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
  /** Display variant: 'list' shows checkboxes, 'dropdown' shows a dropdown menu */
  variant?: "list" | "dropdown";
  /** Placeholder text for dropdown button when no options are selected */
  placeholder?: string;
  /** ID for the 'other' option that allows custom input */
  otherOptionId?: string;
  /** Label for the 'other' option */
  otherOptionLabel?: string;
  /** Placeholder text for the 'other' input field */
  otherOptionPlaceholder?: string;
  /** Custom value entered in the 'other' input field */
  otherValue?: string;
  /** Callback when the 'other' input value changes */
  onOtherValueChange?: (value: string) => void;
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
  variant = "list",
  placeholder = "Select options...",
  otherOptionId,
  otherOptionLabel = "Other",
  otherOptionPlaceholder = "Please specify",
  otherValue = "",
  onOtherValueChange,
}: MultiSelectProps): React.JSX.Element {
  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = Boolean(hasOtherOption && otherOptionId && selectedValues.includes(otherOptionId));

  const handleOptionChange = (optionId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, optionId]);
    } else {
      onChange(selectedValues.filter((id) => id !== optionId));
    }
  };

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onOtherValueChange?.(e.target.value);
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [
      headline,
      description ?? "",
      ...options.map((opt) => opt.label),
      ...(hasOtherOption ? [otherOptionLabel] : []),
    ],
  });

  // Get selected option labels for dropdown display
  const selectedLabels = options.filter((opt) => selectedValues.includes(opt.id)).map((opt) => opt.label);

  const displayText =
    selectedLabels.length > 0
      ? selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`
      : placeholder;

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Options */}
      <div className="relative space-y-3">
        <ElementError errorMessage={errorMessage} dir={detectedDir} />

        {variant === "dropdown" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={disabled}
                  className="w-full justify-between"
                  aria-invalid={Boolean(errorMessage)}
                  aria-label={headline}>
                  <span className="truncate">{displayText}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
                {options.map((option) => {
                  const isChecked = selectedValues.includes(option.id);
                  const optionId = `${inputId}-${option.id}`;

                  return (
                    <DropdownMenuCheckboxItem
                      key={option.id}
                      id={optionId}
                      checked={isChecked}
                      onCheckedChange={(checked) => handleOptionChange(option.id, checked === true)}
                      disabled={disabled}
                      className="cursor-pointer">
                      <Label>{option.label}</Label>
                    </DropdownMenuCheckboxItem>
                  );
                })}
                {hasOtherOption && otherOptionId && (
                  <DropdownMenuCheckboxItem
                    id={`${inputId}-${otherOptionId}`}
                    checked={isOtherSelected}
                    onCheckedChange={(checked) => handleOptionChange(otherOptionId, checked === true)}
                    disabled={disabled}
                    className="cursor-pointer">
                    <Label>{otherOptionLabel}</Label>
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {isOtherSelected && (
              <Input
                type="text"
                value={otherValue}
                onChange={handleOtherInputChange}
                placeholder={otherOptionPlaceholder}
                disabled={disabled}
                dir={detectedDir}
                className="w-full"
                autoFocus
              />
            )}
          </>
        ) : (
          <div className="space-y-3" role="group" aria-labelledby={inputId}>
            {options.map((option) => {
              const isChecked = selectedValues.includes(option.id);
              const optionId = `${inputId}-${option.id}`;

              return (
                <Label
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
                  <span className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                    {option.label}
                  </span>
                </Label>
              );
            })}
            {hasOtherOption && otherOptionId && (
              <div className="space-y-2">
                <label
                  htmlFor={`${inputId}-${otherOptionId}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md transition-colors",
                    disabled && "cursor-not-allowed opacity-50"
                  )}>
                  <Checkbox
                    id={`${inputId}-${otherOptionId}`}
                    checked={isOtherSelected}
                    onCheckedChange={(checked) => handleOptionChange(otherOptionId, checked === true)}
                    disabled={disabled}
                    aria-invalid={Boolean(errorMessage)}
                  />
                  <span className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                    {otherOptionLabel}
                  </span>
                </label>
                {isOtherSelected && (
                  <Input
                    type="text"
                    value={otherValue}
                    onChange={handleOtherInputChange}
                    placeholder={otherOptionPlaceholder}
                    disabled={disabled}
                    dir={detectedDir}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { MultiSelect };
export type { MultiSelectProps };

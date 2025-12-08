import { ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/general/dropdown-menu";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { Label } from "@/components/general/label";
import { RadioGroup, RadioGroupItem } from "@/components/general/radio-group";
import { useTextDirection } from "@/hooks/use-text-direction";
import { cn } from "@/lib/utils";

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
  /** Display variant: 'list' shows radio buttons, 'dropdown' shows a dropdown menu */
  variant?: "list" | "dropdown";
  /** Placeholder text for dropdown button when no option is selected */
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
  variant = "list",
  placeholder = "Select an option...",
  otherOptionId,
  otherOptionLabel = "Other",
  otherOptionPlaceholder = "Please specify",
  otherValue = "",
  onOtherValueChange,
}: SingleSelectProps): React.JSX.Element {
  // Ensure value is always a string or undefined
  const selectedValue = value ?? undefined;
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = hasOtherOption && selectedValue === otherOptionId;

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
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

  // Get selected option label for dropdown display
  const selectedOption = options.find((opt) => opt.id === selectedValue);
  const displayText = isOtherSelected
    ? otherValue || otherOptionLabel
    : (selectedOption?.label ?? placeholder);

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Options */}
      <div className="space-y-3">
        {variant === "dropdown" ? (
          <>
            <ElementError errorMessage={errorMessage} dir={detectedDir} />
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
                <DropdownMenuRadioGroup value={selectedValue} onValueChange={onChange}>
                  {options.map((option) => {
                    const optionId = `${inputId}-${option.id}`;

                    return (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        id={optionId}
                        disabled={disabled}>
                        <Label>{option.label}</Label>
                      </DropdownMenuRadioItem>
                    );
                  })}
                  {hasOtherOption && otherOptionId ? (
                    <DropdownMenuRadioItem
                      value={otherOptionId}
                      id={`${inputId}-${otherOptionId}`}
                      disabled={disabled}>
                      <Label>{otherOptionLabel}</Label>
                    </DropdownMenuRadioItem>
                  ) : null}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {isOtherSelected ? (
              <Input
                type="text"
                value={otherValue}
                onChange={handleOtherInputChange}
                placeholder={otherOptionPlaceholder}
                disabled={disabled}
                dir={detectedDir}
                className="w-full"
              />
            ) : null}
          </>
        ) : (
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
                  <span className="leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                    {option.label}
                  </span>
                </label>
              );
            })}
            {hasOtherOption && otherOptionId ? (
              <div className="space-y-2">
                <Label
                  htmlFor={`${inputId}-${otherOptionId}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md transition-colors",
                    disabled && "cursor-not-allowed opacity-50"
                  )}>
                  <RadioGroupItem
                    value={otherOptionId}
                    id={`${inputId}-${otherOptionId}`}
                    disabled={disabled}
                  />
                  <span>{otherOptionLabel}</span>
                </Label>
                {isOtherSelected ? (
                  <Input
                    type="text"
                    value={otherValue}
                    onChange={handleOtherInputChange}
                    placeholder={otherOptionPlaceholder}
                    disabled={disabled}
                    dir={detectedDir}
                  />
                ) : null}
              </div>
            ) : null}
          </RadioGroup>
        )}
      </div>
    </div>
  );
}

export { SingleSelect };
export type { SingleSelectProps };

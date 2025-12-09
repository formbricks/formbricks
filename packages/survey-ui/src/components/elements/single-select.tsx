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
import { RadioGroup, RadioGroupItem } from "@/components/general/radio-group";
import { useTextDirection } from "@/hooks/use-text-direction";
import { cn } from "@/lib/utils";

/**
 * Option for single-select element
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
  /** The main element or prompt text displayed as the headline */
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

  // Helper function to get option container styles
  const getOptionContainerStyle = (isSelected: boolean): React.CSSProperties => ({
    borderRadius: "var(--fb-option-border-radius)",
    padding: "var(--fb-option-padding-y) var(--fb-option-padding-x)",
    backgroundColor: isSelected ? "var(--fb-option-selected-background)" : "var(--fb-option-bg-color)",
    borderColor: isSelected ? "var(--fb-option-selected-border)" : "var(--fb-option-border-color)",
  });

  // Helper function to get option label styles
  const getOptionLabelStyle = (): React.CSSProperties => ({
    color: "var(--fb-option-label-color)",
    fontFamily: "var(--fb-option-font-family)",
    fontSize: "var(--fb-option-font-size)",
    fontWeight: "var(--fb-option-font-weight)",
  });

  // Shared className for option containers
  const optionContainerClassName = cn(
    "relative flex cursor-pointer flex-col border transition-colors outline-none",
    "focus-within:border-[var(--fb-option-selected-border)] focus-within:bg-[var(--fb-option-selected-background)]",
    "hover:bg-[var(--fb-option-hover-bg-color)]",
    disabled && "cursor-not-allowed opacity-50"
  );
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
              <DropdownMenuContent
                className="w-[var(--radix-dropdown-menu-trigger-width)]"
                align="start"
                style={{ backgroundColor: "var(--fb-option-bg-color)" }}>
                <DropdownMenuRadioGroup value={selectedValue} onValueChange={onChange}>
                  {options.map((option) => {
                    const optionId = `${inputId}-${option.id}`;

                    return (
                      <DropdownMenuRadioItem
                        key={option.id}
                        value={option.id}
                        id={optionId}
                        disabled={disabled}>
                        <span style={getOptionLabelStyle()}>{option.label}</span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                  {hasOtherOption && otherOptionId ? (
                    <DropdownMenuRadioItem
                      value={otherOptionId}
                      id={`${inputId}-${otherOptionId}`}
                      disabled={disabled}>
                      <span style={getOptionLabelStyle()}>{otherOptionLabel}</span>
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
            className="w-full gap-0 space-y-2">
            {options.map((option) => {
              const optionId = `${inputId}-${option.id}`;
              const isSelected = selectedValue === option.id;

              return (
                <label
                  key={option.id}
                  htmlFor={optionId}
                  style={getOptionContainerStyle(isSelected)}
                  className={cn(optionContainerClassName, isSelected && "z-10")}>
                  <span className="flex items-center text-sm">
                    <RadioGroupItem value={option.id} id={optionId} disabled={disabled} />
                    <span className="ml-3 mr-3 grow font-medium" style={getOptionLabelStyle()}>
                      {option.label}
                    </span>
                  </span>
                </label>
              );
            })}
            {hasOtherOption && otherOptionId ? (
              <label
                htmlFor={`${inputId}-${otherOptionId}`}
                style={getOptionContainerStyle(isOtherSelected)}
                className={cn(optionContainerClassName, isOtherSelected && "z-10")}>
                <span className="flex items-center text-sm">
                  <RadioGroupItem
                    value={otherOptionId}
                    id={`${inputId}-${otherOptionId}`}
                    disabled={disabled}
                  />
                  <span className="ml-3 mr-3 grow font-medium" style={getOptionLabelStyle()}>
                    {otherOptionLabel}
                  </span>
                </span>
                {isOtherSelected ? (
                  <Input
                    type="text"
                    value={otherValue}
                    onChange={handleOtherInputChange}
                    placeholder={otherOptionPlaceholder}
                    disabled={disabled}
                    dir={detectedDir}
                    className="mt-2 w-full"
                  />
                ) : null}
              </label>
            ) : null}
          </RadioGroup>
        )}
      </div>
    </div>
  );
}

export { SingleSelect };
export type { SingleSelectProps };

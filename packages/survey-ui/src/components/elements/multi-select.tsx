import { ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import { Checkbox } from "@/components/general/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/general/dropdown-menu";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { cn } from "@/lib/utils";

/**
 * Option for multi-select element
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
  /** The main element or prompt text displayed as the headline */
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
  /** IDs of options that should be exclusive (selecting them deselects all others) */
  exclusiveOptionIds?: string[];
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
  exclusiveOptionIds = [],
}: MultiSelectProps): React.JSX.Element {
  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = Boolean(hasOtherOption && otherOptionId && selectedValues.includes(otherOptionId));
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOtherSelected || disabled) return;

    // Delay focus to win against Radix focus restoration when dropdown closes / checkbox receives focus.
    const timeoutId = globalThis.setTimeout(() => {
      globalThis.requestAnimationFrame(() => {
        otherInputRef.current?.focus();
      });
    }, 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [isOtherSelected, disabled, variant]);

  const handleOptionChange = (optionId: string, checked: boolean): void => {
    if (checked) {
      if (exclusiveOptionIds.includes(optionId)) {
        onChange([optionId]);
      } else {
        const newValues = selectedValues.filter((id) => !exclusiveOptionIds.includes(id));
        onChange([...newValues, optionId]);
      }
    } else {
      onChange(selectedValues.filter((id) => id !== optionId));
    }
  };

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onOtherValueChange?.(e.target.value);
  };

  // Shared className for option containers
  const getOptionContainerClassName = (isSelected: boolean): string =>
    cn(
      "relative flex cursor-pointer flex-col border transition-colors outline-none",
      "rounded-option px-option-x py-option-y",
      isSelected ? "bg-option-selected-bg border-brand" : "bg-option-bg border-option-border",
      "focus-within:border-brand focus-within:bg-option-selected-bg",
      "hover:bg-option-hover-bg",
      disabled && "cursor-not-allowed opacity-50"
    );

  // Shared className for option labels
  const optionLabelClassName = "font-option text-option font-option-weight text-option-label";

  // Get selected option labels for dropdown display
  const selectedLabels = options.filter((opt) => selectedValues.includes(opt.id)).map((opt) => opt.label);

  let displayText = placeholder;
  if (selectedLabels.length > 0) {
    displayText =
      selectedLabels.length === 1 ? selectedLabels[0] : `${String(selectedLabels.length)} selected`;
  }

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Options */}
      <div className="relative">
        {variant === "dropdown" ? (
          <>
            <ElementError errorMessage={errorMessage} dir={dir} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={disabled}
                  className="rounded-input w-full justify-between"
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
                      onCheckedChange={(checked) => {
                        handleOptionChange(option.id, checked);
                      }}
                      disabled={disabled}>
                      <span className={optionLabelClassName}>{option.label}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
                {hasOtherOption && otherOptionId ? (
                  <DropdownMenuCheckboxItem
                    id={`${inputId}-${otherOptionId}`}
                    checked={isOtherSelected}
                    onCheckedChange={(checked) => {
                      handleOptionChange(otherOptionId, checked);
                    }}
                    disabled={disabled}>
                    <span className={optionLabelClassName}>{otherOptionLabel}</span>
                  </DropdownMenuCheckboxItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {isOtherSelected ? (
              <Input
                ref={otherInputRef}
                type="text"
                value={otherValue}
                onChange={handleOtherInputChange}
                placeholder={otherOptionPlaceholder}
                disabled={disabled}
                dir={dir}
                className="w-full"
              />
            ) : null}
          </>
        ) : (
          <>
            <ElementError errorMessage={errorMessage} dir={dir} />
            <div className="space-y-2" role="group" aria-label={headline}>
              {options.map((option) => {
                const isChecked = selectedValues.includes(option.id);
                const optionId = `${inputId}-${option.id}`;

                return (
                  <label
                    key={option.id}
                    htmlFor={optionId}
                    className={cn(getOptionContainerClassName(isChecked), isChecked && "z-10")}>
                    <span className="flex items-center">
                      <Checkbox
                        id={optionId}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          handleOptionChange(option.id, checked === true);
                        }}
                        disabled={disabled}
                        aria-invalid={Boolean(errorMessage)}
                      />
                      <span className={cn("mr-3 ml-3", optionLabelClassName)}>{option.label}</span>
                    </span>
                  </label>
                );
              })}
              {hasOtherOption && otherOptionId ? (
                <div className="space-y-2">
                  <label
                    htmlFor={`${inputId}-${otherOptionId}`}
                    className={cn(getOptionContainerClassName(isOtherSelected), isOtherSelected && "z-10")}>
                    <span className="flex items-center">
                      <Checkbox
                        id={`${inputId}-${otherOptionId}`}
                        checked={isOtherSelected}
                        onCheckedChange={(checked) => {
                          handleOptionChange(otherOptionId, checked === true);
                        }}
                        disabled={disabled}
                        aria-invalid={Boolean(errorMessage)}
                      />
                      <span className={cn("mr-3 ml-3 grow", optionLabelClassName)}>{otherOptionLabel}</span>
                    </span>
                    {isOtherSelected ? (
                      <Input
                        type="text"
                        value={otherValue}
                        onChange={handleOtherInputChange}
                        placeholder={otherOptionPlaceholder}
                        disabled={disabled}
                        dir={dir}
                        className="mt-2 w-full"
                        ref={otherInputRef}
                      />
                    ) : null}
                  </label>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { MultiSelect };
export type { MultiSelectProps };

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

/**
 * Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content)
 */
type TextDirection = "ltr" | "rtl" | "auto";

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
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display below the options */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: TextDirection;
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
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

// Shared className for option labels
const optionLabelClassName = "font-option text-option font-option-weight text-option-label";

// Shared className for option containers
const getOptionContainerClassName = (isSelected: boolean, isDisabled: boolean): string =>
  cn(
    "relative flex flex-col border transition-colors outline-none",
    "rounded-option px-option-x py-option-y",
    isSelected ? "bg-option-selected-bg border-brand" : "bg-option-bg border-option-border",
    "focus-within:border-brand focus-within:bg-option-selected-bg",
    "hover:bg-option-hover-bg",
    isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
  );

interface DropdownVariantProps {
  inputId: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  handleOptionAdd: (optionId: string) => void;
  handleOptionRemove: (optionId: string) => void;
  disabled: boolean;
  headline: string;
  errorMessage?: string;
  displayText: string;
  hasOtherOption: boolean;
  otherOptionId?: string;
  isOtherSelected: boolean;
  otherOptionLabel: string;
  otherValue: string;
  handleOtherInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  otherOptionPlaceholder: string;
  dir: TextDirection;
  otherInputRef: React.RefObject<HTMLInputElement | null>;
  required: boolean;
}

function DropdownVariant({
  inputId,
  options,
  selectedValues,
  handleOptionAdd,
  handleOptionRemove,
  disabled,
  headline,
  errorMessage,
  displayText,
  hasOtherOption,
  otherOptionId,
  isOtherSelected,
  otherOptionLabel,
  otherValue,
  handleOtherInputChange,
  otherOptionPlaceholder,
  dir,
  otherInputRef,
  required,
}: Readonly<DropdownVariantProps>): React.JSX.Element {
  const handleOptionToggle = (optionId: string) => {
    if (selectedValues.includes(optionId)) {
      handleOptionRemove(optionId);
    } else {
      handleOptionAdd(optionId);
    }
  };

  return (
    <div>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="rounded-input min-h-input bg-input-bg border-input-border text-input-text py-input-y px-input-x w-full justify-between"
            aria-invalid={Boolean(errorMessage)}
            aria-label={headline}>
            <span className="font-input font-input-weight text-input-text truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="bg-option-bg max-h-[300px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
          align="start">
          {options
            .filter((option) => option.id !== "none")
            .map((option) => {
              const isChecked = selectedValues.includes(option.id);
              const optionId = `${inputId}-${option.id}`;

              return (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  id={optionId}
                  dir={dir}
                  checked={isChecked}
                  onCheckedChange={() => {
                    handleOptionToggle(option.id);
                  }}
                  onSelect={(e) => {
                    e.preventDefault();
                  }}
                  disabled={disabled}>
                  <span className="font-input font-input-weight text-input-text">{option.label}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
          {hasOtherOption && otherOptionId ? (
            <DropdownMenuCheckboxItem
              id={`${inputId}-${otherOptionId}`}
              dir={dir}
              checked={isOtherSelected}
              onCheckedChange={() => {
                if (isOtherSelected) {
                  handleOptionRemove(otherOptionId);
                } else {
                  handleOptionAdd(otherOptionId);
                }
              }}
              onSelect={(e) => {
                e.preventDefault();
              }}
              disabled={disabled}>
              <span className="font-input font-input-weight text-input-text">{otherOptionLabel}</span>
            </DropdownMenuCheckboxItem>
          ) : null}
          {options
            .filter((option) => option.id === "none")
            .map((option) => {
              const isChecked = selectedValues.includes(option.id);
              const optionId = `${inputId}-${option.id}`;

              return (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  id={optionId}
                  dir={dir}
                  checked={isChecked}
                  onCheckedChange={() => {
                    handleOptionToggle(option.id);
                  }}
                  onSelect={(e) => {
                    e.preventDefault();
                  }}
                  disabled={disabled}>
                  <span className="font-input font-input-weight text-input-text">{option.label}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
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
          aria-required={required}
          dir={dir}
          className="mt-2 w-full"
        />
      ) : null}
    </div>
  );
}

interface ListVariantProps {
  inputId: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  value: string[];
  handleOptionAdd: (optionId: string) => void;
  handleOptionRemove: (optionId: string) => void;
  disabled: boolean;
  headline: string;
  errorMessage?: string;
  hasOtherOption: boolean;
  otherOptionId?: string;
  isOtherSelected: boolean;
  otherOptionLabel: string;
  otherValue: string;
  handleOtherInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  otherOptionPlaceholder: string;
  dir: TextDirection;
  otherInputRef: React.RefObject<HTMLInputElement | null>;
  required: boolean;
}

function ListVariant({
  inputId,
  options,
  selectedValues,
  value,
  handleOptionAdd,
  handleOptionRemove,
  disabled,
  headline,
  errorMessage,
  hasOtherOption,
  otherOptionId,
  isOtherSelected,
  otherOptionLabel,
  otherValue,
  handleOtherInputChange,
  otherOptionPlaceholder,
  dir,
  otherInputRef,
  required,
}: Readonly<ListVariantProps>): React.JSX.Element {
  const isNoneSelected = value.includes("none");

  return (
    <>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <fieldset className="space-y-2" aria-label={headline}>
        {options
          .filter((option) => option.id !== "none")
          .map((option) => {
            const isChecked = selectedValues.includes(option.id);
            const optionId = `${inputId}-${option.id}`;
            const isDisabled = disabled || (isNoneSelected && option.id !== "none");
            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className={cn(getOptionContainerClassName(isChecked, isDisabled), isChecked && "z-10")}>
                <span className="flex items-center">
                  <Checkbox
                    id={optionId}
                    name={inputId}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        handleOptionAdd(option.id);
                      } else {
                        handleOptionRemove(option.id);
                      }
                    }}
                    disabled={isDisabled}
                    aria-invalid={Boolean(errorMessage)}
                  />
                  <span className={cn("mx-3", optionLabelClassName)}>{option.label}</span>
                </span>
              </label>
            );
          })}
        {hasOtherOption && otherOptionId ? (
          <div className="space-y-2">
            <label
              htmlFor={`${inputId}-${otherOptionId}`}
              className={cn(
                getOptionContainerClassName(isOtherSelected, disabled || isNoneSelected),
                isOtherSelected && "z-10"
              )}>
              <span className="flex items-center">
                <Checkbox
                  id={`${inputId}-${otherOptionId}`}
                  name={inputId}
                  checked={isOtherSelected}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      handleOptionAdd(otherOptionId);
                    } else {
                      handleOptionRemove(otherOptionId);
                    }
                  }}
                  disabled={disabled || isNoneSelected}
                  aria-invalid={Boolean(errorMessage)}
                />
                <span className={cn("mx-3 grow", optionLabelClassName)}>{otherOptionLabel}</span>
              </span>
              {isOtherSelected ? (
                <Input
                  type="text"
                  value={otherValue}
                  onChange={handleOtherInputChange}
                  placeholder={otherOptionPlaceholder}
                  disabled={disabled}
                  aria-required={required}
                  dir={dir}
                  className="mt-2 w-full"
                  ref={otherInputRef}
                />
              ) : null}
            </label>
          </div>
        ) : null}
        {options
          .filter((option) => option.id === "none")
          .map((option) => {
            const isChecked = selectedValues.includes(option.id);
            const optionId = `${inputId}-${option.id}`;
            const isDisabled = disabled || (isNoneSelected && option.id !== "none");
            return (
              <label
                key={option.id}
                htmlFor={optionId}
                className={cn(getOptionContainerClassName(isChecked, isDisabled), isChecked && "z-10")}>
                <span className="flex items-center">
                  <Checkbox
                    id={optionId}
                    name={inputId}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        handleOptionAdd(option.id);
                      } else {
                        handleOptionRemove(option.id);
                      }
                    }}
                    disabled={isDisabled}
                    required={false}
                    aria-invalid={Boolean(errorMessage)}
                  />
                  <span className={cn("mx-3", optionLabelClassName)}>{option.label}</span>
                </span>
              </label>
            );
          })}
      </fieldset>
    </>
  );
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
  requiredLabel,
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
  imageUrl,
  videoUrl,
}: Readonly<MultiSelectProps>): React.JSX.Element {
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

  const handleOptionAdd = (optionId: string): void => {
    if (exclusiveOptionIds.includes(optionId)) {
      onChange([optionId]);
    } else {
      const newValues = selectedValues.filter((id) => !exclusiveOptionIds.includes(id));
      onChange([...newValues, optionId]);
    }
  };

  const handleOptionRemove = (optionId: string): void => {
    onChange(selectedValues.filter((id) => id !== optionId));
  };

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onOtherValueChange?.(e.target.value);
  };

  // Get selected option labels for dropdown display
  const selectedLabels = options.filter((opt) => selectedValues.includes(opt.id)).map((opt) => opt.label);

  // Handle "other" option label display
  if (hasOtherOption && otherOptionId && selectedValues.includes(otherOptionId)) {
    const otherLabel = otherValue || otherOptionLabel;
    if (!selectedLabels.includes(otherLabel)) {
      selectedLabels.push(otherLabel);
    }
  }

  let displayText = placeholder;
  if (selectedLabels.length > 0) {
    displayText = selectedLabels.join(", ");
  }

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        requiredLabel={requiredLabel}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* Options */}
      <div className="relative">
        {variant === "dropdown" ? (
          <DropdownVariant
            inputId={inputId}
            options={options}
            selectedValues={selectedValues}
            handleOptionAdd={handleOptionAdd}
            handleOptionRemove={handleOptionRemove}
            disabled={disabled}
            headline={headline}
            errorMessage={errorMessage}
            displayText={displayText}
            hasOtherOption={hasOtherOption}
            otherOptionId={otherOptionId}
            isOtherSelected={isOtherSelected}
            otherOptionLabel={otherOptionLabel}
            otherValue={otherValue}
            handleOtherInputChange={handleOtherInputChange}
            otherOptionPlaceholder={otherOptionPlaceholder}
            dir={dir}
            otherInputRef={otherInputRef}
            required={required}
          />
        ) : (
          <ListVariant
            inputId={inputId}
            options={options}
            selectedValues={selectedValues}
            value={value}
            handleOptionAdd={handleOptionAdd}
            handleOptionRemove={handleOptionRemove}
            disabled={disabled}
            headline={headline}
            errorMessage={errorMessage}
            hasOtherOption={hasOtherOption}
            otherOptionId={otherOptionId}
            isOtherSelected={isOtherSelected}
            otherOptionLabel={otherOptionLabel}
            otherValue={otherValue}
            handleOtherInputChange={handleOtherInputChange}
            otherOptionPlaceholder={otherOptionPlaceholder}
            dir={dir}
            otherInputRef={otherInputRef}
            required={required}
          />
        )}
      </div>
    </div>
  );
}

export { MultiSelect };
export type { MultiSelectProps };

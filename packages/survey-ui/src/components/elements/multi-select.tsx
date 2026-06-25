import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/general/dropdown-menu";
import {
  DropdownSearchInput,
  SEARCH_THRESHOLD,
  useDropdownSearch,
} from "@/components/general/dropdown-search";
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
  /** Placeholder text for the search input in dropdown mode */
  searchPlaceholder?: string;
  /** Message shown when search yields no results */
  searchNoResultsText?: string;
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

/**
 * Custom checkbox indicator driven by the sibling native input's :checked state via the Tailwind
 * `peer` utility. The native <input type="checkbox"> is visually hidden (sr-only) but stays in the
 * DOM as the real, focusable control; this span only paints the box and tick.
 */
function CheckboxIndicator(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "border-input-border text-brand-foreground relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border bg-white shadow-xs transition-colors",
        "peer-checked:bg-brand peer-checked:border-brand",
        // The tick lives inside this sibling span, so reveal it via a peer-checked descendant rule.
        "[&>svg]:opacity-0 [&>svg]:transition-opacity peer-checked:[&>svg]:opacity-100"
      )}>
      <Check className="size-3.5" />
    </span>
  );
}

interface MultiSelectOptionItemProps {
  inputId: string;
  option: MultiSelectOption;
  isChecked: boolean;
  isDisabled: boolean;
  errorMessage?: string;
  onAdd: (optionId: string) => void;
  onRemove: (optionId: string) => void;
}

function MultiSelectOptionItem({
  inputId,
  option,
  isChecked,
  isDisabled,
  errorMessage,
  onAdd,
  onRemove,
}: Readonly<MultiSelectOptionItemProps>): React.JSX.Element {
  const optionId = `${inputId}-${option.id}`;

  return (
    <label
      key={option.id}
      htmlFor={optionId}
      className={cn(getOptionContainerClassName(isChecked, isDisabled), isChecked && "z-10")}>
      <span className="flex items-center">
        <input
          type="checkbox"
          id={optionId}
          name={inputId}
          value={option.id}
          checked={isChecked}
          disabled={isDisabled}
          aria-invalid={Boolean(errorMessage)}
          className="peer sr-only"
          onChange={(e) => {
            if (e.target.checked) {
              onAdd(option.id);
            } else {
              onRemove(option.id);
            }
          }}
        />
        <CheckboxIndicator />
        <span className={cn("mx-3", optionLabelClassName)}>{option.label}</span>
      </span>
    </label>
  );
}

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
  searchPlaceholder: string;
  searchNoResultsText: string;
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
  searchPlaceholder,
  searchNoResultsText,
}: Readonly<DropdownVariantProps>): React.JSX.Element {
  const handleOptionToggle = (optionId: string): void => {
    if (selectedValues.includes(optionId)) {
      handleOptionRemove(optionId);
    } else {
      handleOptionAdd(optionId);
    }
  };

  // Search + side-locking
  const allDropdownOptionCount = options.length + (hasOtherOption ? 1 : 0);
  const showSearch = allDropdownOptionCount > SEARCH_THRESHOLD;

  const {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    lockedSide,
    contentRef,
    noneOption,
    noneMatchesSearch,
    filteredRegularOptions,
    otherMatchesSearch,
    hasNoResults,
    handleDropdownOpen,
    handleDropdownClose,
  } = useDropdownSearch({ options, hasOtherOption, otherOptionLabel, isSearchEnabled: showSearch });

  return (
    <div>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) handleDropdownOpen();
          else handleDropdownClose();
        }}>
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
          ref={contentRef}
          side={lockedSide}
          avoidCollisions={lockedSide === undefined}
          className="bg-option-bg border-input-border w-(--radix-dropdown-menu-trigger-width) overflow-hidden"
          align="start">
          {showSearch ? (
            <DropdownSearchInput
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchInputRef={searchInputRef}
              placeholder={searchPlaceholder}
              dir={dir}
            />
          ) : null}
          <div className="max-h-[260px] overflow-y-auto">
            {filteredRegularOptions.map((option) => {
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
            {otherMatchesSearch && otherOptionId ? (
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
            {noneOption && noneMatchesSearch ? (
              <DropdownMenuCheckboxItem
                key={noneOption.id}
                id={`${inputId}-${noneOption.id}`}
                dir={dir}
                checked={selectedValues.includes(noneOption.id)}
                onCheckedChange={() => {
                  handleOptionToggle(noneOption.id);
                }}
                onSelect={(e) => {
                  e.preventDefault();
                }}
                disabled={disabled}>
                <span className="font-input font-input-weight text-input-text">{noneOption.label}</span>
              </DropdownMenuCheckboxItem>
            ) : null}
            {hasNoResults ? (
              <div className="text-input-placeholder px-2 py-4 text-center text-sm">
                {searchNoResultsText}
              </div>
            ) : null}
          </div>
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
          aria-required
          aria-invalid={Boolean(errorMessage)}
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
}

function ListVariant({
  inputId,
  options,
  selectedValues,
  value,
  handleOptionAdd,
  handleOptionRemove,
  disabled,
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
}: Readonly<ListVariantProps>): React.JSX.Element {
  const isNoneSelected = value.includes("none");
  const otherTextId = otherOptionId ? `${inputId}-${otherOptionId}-input` : undefined;

  const renderOption = (option: MultiSelectOption): React.JSX.Element => {
    const isChecked = selectedValues.includes(option.id);
    const isDisabled = disabled || (isNoneSelected && option.id !== "none");
    return (
      <MultiSelectOptionItem
        key={option.id}
        inputId={inputId}
        option={option}
        isChecked={isChecked}
        isDisabled={isDisabled}
        errorMessage={errorMessage}
        onAdd={handleOptionAdd}
        onRemove={handleOptionRemove}
      />
    );
  };

  return (
    <>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <div className="space-y-2">
        {options.filter((option) => option.id !== "none").map(renderOption)}
        {hasOtherOption && otherOptionId ? (
          // The free-text input must NOT live inside the option <label>: a label may own only one
          // labelable control, and label-area clicks would forward to the checkbox and toggle "Other"
          // off. The bordered box is a plain container; only the option row is the checkbox's label.
          <div
            className={cn(
              getOptionContainerClassName(isOtherSelected, disabled || isNoneSelected),
              isOtherSelected && "z-10"
            )}>
            <label htmlFor={`${inputId}-${otherOptionId}`} className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                id={`${inputId}-${otherOptionId}`}
                name={inputId}
                value={otherOptionId}
                checked={isOtherSelected}
                disabled={disabled || isNoneSelected}
                aria-invalid={Boolean(errorMessage)}
                className="peer sr-only"
                onChange={(e) => {
                  if (e.target.checked) {
                    handleOptionAdd(otherOptionId);
                  } else {
                    handleOptionRemove(otherOptionId);
                  }
                }}
              />
              <CheckboxIndicator />
              <span className={cn("mx-3 grow", optionLabelClassName)}>{otherOptionLabel}</span>
            </label>
            {isOtherSelected ? (
              <Input
                type="text"
                id={otherTextId}
                value={otherValue}
                onChange={handleOtherInputChange}
                placeholder={otherOptionPlaceholder}
                disabled={disabled}
                aria-required
                aria-label={otherOptionLabel}
                aria-invalid={Boolean(errorMessage)}
                dir={dir}
                className="mt-2 w-full"
                ref={otherInputRef}
              />
            ) : null}
          </div>
        ) : null}
        {options.filter((option) => option.id === "none").map(renderOption)}
      </div>
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
  searchPlaceholder = "Search...",
  searchNoResultsText = "No results found",
}: Readonly<MultiSelectProps>): React.JSX.Element {
  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = Boolean(hasOtherOption && otherOptionId && selectedValues.includes(otherOptionId));
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOtherSelected || disabled) return;

    // Delay focus to win against focus restoration when dropdown closes / checkbox receives focus.
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

  const isListVariant = variant === "list";

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {isListVariant ? (
        // A checkbox group is role="group", which doesn't support aria-required (only the
        // legend's visible "Required" conveys it). aria-invalid is a global attribute, so it stays.
        <fieldset className="w-full space-y-4" aria-invalid={Boolean(errorMessage)}>
          <ElementHeader
            as="legend"
            headline={headline}
            description={description}
            required={required}
            requiredLabel={requiredLabel}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
          />
          <div className="relative" data-element-input>
            <ListVariant
              inputId={inputId}
              options={options}
              selectedValues={selectedValues}
              value={value}
              handleOptionAdd={handleOptionAdd}
              handleOptionRemove={handleOptionRemove}
              disabled={disabled}
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
            />
          </div>
        </fieldset>
      ) : (
        <>
          {/* Dropdown trigger is a Radix menu button that names itself via aria-label={headline};
              the headline is a plain label here (no htmlFor) to avoid pointing at a non-input. */}
          <ElementHeader
            headline={headline}
            description={description}
            required={required}
            requiredLabel={requiredLabel}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
          />
          <div className="relative" data-element-input>
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
              searchPlaceholder={searchPlaceholder}
              searchNoResultsText={searchNoResultsText}
            />
          </div>
        </>
      )}
    </div>
  );
}

export { MultiSelect };
export type { MultiSelectProps };

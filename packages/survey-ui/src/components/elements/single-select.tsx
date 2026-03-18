import { ChevronDown, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";

/** Number of options above which the search input is shown inside the dropdown */
const SEARCH_THRESHOLD = 5;

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
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display below the options */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-right), or 'auto' (auto-detect from content) */
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
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
  /** Placeholder text for the search input in dropdown mode */
  searchPlaceholder?: string;
  /** Message shown when search yields no results */
  searchNoResultsText?: string;
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
  requiredLabel,
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
  imageUrl,
  videoUrl,
  searchPlaceholder = "Search...",
  searchNoResultsText = "No results found",
}: Readonly<SingleSelectProps>): React.JSX.Element {
  // Ensure value is always a string or undefined
  const selectedValue = value ?? undefined;
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = hasOtherOption && selectedValue === otherOptionId;
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  // Search state for the dropdown variant
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Total option count including "other" to determine whether to show search
  const allDropdownOptionCount = options.length + (hasOtherOption ? 1 : 0);
  const showSearch = variant === "dropdown" && allDropdownOptionCount > SEARCH_THRESHOLD;

  // Separate "none" option from regular options — "none" is always visible regardless of search
  const noneOption = React.useMemo(() => options.find((opt) => opt.id === "none"), [options]);
  const regularOptions = React.useMemo(() => options.filter((opt) => opt.id !== "none"), [options]);

  // Filtered regular options based on the search query (only active when search is shown)
  const filteredRegularOptions = React.useMemo(() => {
    if (!showSearch || !searchQuery) return regularOptions;
    const lowerQuery = searchQuery.toLowerCase();
    return regularOptions.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
  }, [showSearch, searchQuery, regularOptions]);

  // Whether the "other" option matches the search
  const otherMatchesSearch = React.useMemo(() => {
    if (!hasOtherOption) return false;
    if (!showSearch || !searchQuery) return true;
    return otherOptionLabel.toLowerCase().includes(searchQuery.toLowerCase());
  }, [showSearch, searchQuery, hasOtherOption, otherOptionLabel]);

  const handleDropdownOpenChange = (open: boolean): void => {
    if (!open) {
      setSearchQuery("");
    } else if (showSearch) {
      // Focus the search input when dropdown opens, using the same double-defer pattern
      // as the "other" input focus to win against Radix focus management.
      globalThis.setTimeout(() => {
        globalThis.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }, 0);
    }
  };

  React.useEffect(() => {
    if (!isOtherSelected || disabled) return;

    // Delay focus to win against Radix focus restoration when dropdown closes / radio item receives focus.
    const timeoutId = globalThis.setTimeout(() => {
      globalThis.requestAnimationFrame(() => {
        otherInputRef.current?.focus();
      });
    }, 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [isOtherSelected, disabled, variant]);

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

  // Get selected option label for dropdown display
  const selectedOption = options.find((opt) => opt.id === selectedValue);
  const displayText = isOtherSelected
    ? otherValue || otherOptionLabel
    : (selectedOption?.label ?? placeholder);

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
      <div>
        {variant === "dropdown" ? (
          <>
            <ElementError errorMessage={errorMessage} dir={dir} />
            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
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
                className="bg-option-bg w-[var(--radix-dropdown-menu-trigger-width)]"
                align="start">
                {showSearch ? (
                  <div className="border-option-border border-b px-2 py-2" role="search">
                    <div className="relative flex items-center">
                      <Search className="text-input-placeholder pointer-events-none absolute left-2 h-4 w-4 shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        dir={dir}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            if (searchQuery) {
                              e.stopPropagation();
                              setSearchQuery("");
                            }
                          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            // Let arrow keys propagate so Radix can move focus to options
                          } else {
                            e.stopPropagation();
                          }
                        }}
                        className="bg-input-bg text-input-text placeholder:text-input-placeholder font-input font-input-weight w-full rounded-sm py-1 pr-2 pl-7 text-sm outline-none"
                        aria-label={searchPlaceholder}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ) : null}
                <div className="max-h-[260px] overflow-y-auto">
                  <DropdownMenuRadioGroup value={selectedValue} onValueChange={onChange}>
                    {filteredRegularOptions.map((option) => {
                      const optionId = `${inputId}-${option.id}`;

                      return (
                        <DropdownMenuRadioItem
                          key={option.id}
                          value={option.id}
                          id={optionId}
                          dir={dir}
                          disabled={disabled}>
                          <span className="font-input font-input-weight text-input-text">{option.label}</span>
                        </DropdownMenuRadioItem>
                      );
                    })}
                    {otherMatchesSearch && otherOptionId ? (
                      <DropdownMenuRadioItem
                        value={otherOptionId}
                        id={`${inputId}-${otherOptionId}`}
                        dir={dir}
                        disabled={disabled}>
                        <span className="font-input font-input-weight text-input-text">
                          {otherValue || otherOptionLabel}
                        </span>
                      </DropdownMenuRadioItem>
                    ) : null}
                    {noneOption ? (
                      <DropdownMenuRadioItem
                        key={noneOption.id}
                        value={noneOption.id}
                        id={`${inputId}-${noneOption.id}`}
                        dir={dir}
                        disabled={disabled}>
                        <span className="font-input font-input-weight text-input-text">
                          {noneOption.label}
                        </span>
                      </DropdownMenuRadioItem>
                    ) : null}
                    {showSearch && filteredRegularOptions.length === 0 && !otherMatchesSearch ? (
                      <div className="text-input-placeholder px-2 py-4 text-center text-sm">
                        {searchNoResultsText}
                      </div>
                    ) : null}
                  </DropdownMenuRadioGroup>
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
                dir={dir}
                className="mt-2 w-full"
              />
            ) : null}
          </>
        ) : (
          <div className="relative">
            <ElementError errorMessage={errorMessage} dir={dir} />
            <RadioGroup
              name={inputId}
              value={selectedValue}
              onValueChange={onChange}
              disabled={disabled}
              errorMessage={errorMessage}
              className="w-full gap-0 space-y-2">
              {options
                .filter((option) => option.id !== "none")
                .map((option) => {
                  const optionId = `${inputId}-${option.id}`;
                  const isSelected = selectedValue === option.id;

                  return (
                    <label
                      key={option.id}
                      dir={dir}
                      htmlFor={optionId}
                      className={cn(getOptionContainerClassName(isSelected), isSelected && "z-10")}>
                      <span className="flex items-center">
                        <RadioGroupItem
                          value={option.id}
                          id={optionId}
                          disabled={disabled}
                          aria-required={required}
                        />
                        <span className={cn("mx-3 grow", optionLabelClassName)}>{option.label}</span>
                      </span>
                    </label>
                  );
                })}
              {hasOtherOption && otherOptionId ? (
                <label
                  htmlFor={`${inputId}-${otherOptionId}`}
                  dir={dir}
                  className={cn(getOptionContainerClassName(isOtherSelected), isOtherSelected && "z-10")}>
                  <span className="flex items-center">
                    <RadioGroupItem
                      value={otherOptionId}
                      id={`${inputId}-${otherOptionId}`}
                      disabled={disabled}
                      aria-required={required}
                    />
                    <span className={cn("mr-3 ml-3 grow", optionLabelClassName)}>{otherOptionLabel}</span>
                  </span>
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
                </label>
              ) : null}
              {options
                .filter((option) => option.id === "none")
                .map((option) => {
                  const optionId = `${inputId}-${option.id}`;
                  const isSelected = selectedValue === option.id;

                  return (
                    <label
                      key={option.id}
                      htmlFor={optionId}
                      dir={dir}
                      className={cn(getOptionContainerClassName(isSelected), isSelected && "z-10")}>
                      <span className="flex items-center">
                        <RadioGroupItem
                          value={option.id}
                          id={optionId}
                          disabled={disabled}
                          aria-required={required}
                        />
                        <span className={cn("mx-3 grow", optionLabelClassName)}>{option.label}</span>
                      </span>
                    </label>
                  );
                })}
            </RadioGroup>
          </div>
        )}
      </div>
    </div>
  );
}

export { SingleSelect };
export type { SingleSelectProps };

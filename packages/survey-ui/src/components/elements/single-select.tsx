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
import {
  DropdownSearchInput,
  SEARCH_THRESHOLD,
  useDropdownSearch,
} from "@/components/general/dropdown-search";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { useRovingRadioGroup } from "@/lib/use-roving-radio-group";
import { cn } from "@/lib/utils";

type Direction = "ltr" | "rtl" | "auto";
type SingleSelectVariant = "list" | "dropdown";

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
  onChange: (value: string | undefined) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display below the options */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-right), or 'auto' (auto-detect from content) */
  dir?: Direction;
  /** Whether the options are disabled */
  disabled?: boolean;
  /** Display variant: 'list' shows radio buttons, 'dropdown' shows a dropdown menu */
  variant?: SingleSelectVariant;
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

const useDropdownCommitState = ({
  variant,
  selectedValue,
  onChange,
  handleDropdownOpen,
  handleDropdownClose,
}: {
  variant: SingleSelectVariant;
  selectedValue: string | undefined;
  onChange: (value: string | undefined) => void;
  handleDropdownOpen: () => void;
  handleDropdownClose: () => void;
}): {
  effectiveSelectedValue: string | undefined;
  handleDropdownOpenChange: (open: boolean) => void;
  setPendingDropdownValue: React.Dispatch<React.SetStateAction<string | undefined>>;
  setHasPendingDropdownChange: React.Dispatch<React.SetStateAction<boolean>>;
} => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [pendingDropdownValue, setPendingDropdownValue] = React.useState<string | undefined>(selectedValue);
  const [hasPendingDropdownChange, setHasPendingDropdownChange] = React.useState(false);

  React.useEffect(() => {
    if (!isDropdownOpen) {
      setPendingDropdownValue(selectedValue);
      setHasPendingDropdownChange(false);
    }
  }, [selectedValue, isDropdownOpen]);

  const handleDropdownOpenChange = (open: boolean): void => {
    setIsDropdownOpen(open);
    if (open) {
      setPendingDropdownValue(selectedValue);
      setHasPendingDropdownChange(false);
      handleDropdownOpen();
      return;
    }

    handleDropdownClose();
    if (hasPendingDropdownChange && pendingDropdownValue && pendingDropdownValue !== selectedValue) {
      onChange(pendingDropdownValue);
    }
    setHasPendingDropdownChange(false);
  };

  const effectiveSelectedValue =
    variant === "dropdown" && isDropdownOpen ? pendingDropdownValue : selectedValue;

  return {
    effectiveSelectedValue,
    handleDropdownOpenChange,
    setPendingDropdownValue,
    setHasPendingDropdownChange,
  };
};

interface DropdownVariantProps {
  inputId: string;
  dir: Direction;
  disabled: boolean;
  errorMessage?: string;
  placeholder: string;
  selectedValue: string | undefined;
  effectiveSelectedValue: string | undefined;
  setPendingDropdownValue: (value: string | undefined) => void;
  setHasPendingDropdownChange: (changed: boolean) => void;
  handleDropdownOpenChange: (open: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  lockedSide: "top" | "bottom" | "left" | "right" | undefined;
  showSearch: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchPlaceholder: string;
  searchNoResultsText: string;
  focusMenuItem: (which: "first" | "last") => void;
  handleContentKeyDown: (e: React.KeyboardEvent) => void;
  filteredRegularOptions: SingleSelectOption[];
  otherMatchesSearch: boolean;
  otherOptionId?: string;
  otherOptionLabel: string;
  otherOptionPlaceholder: string;
  otherValue: string;
  isOtherSelected: boolean;
  otherInputRef: React.RefObject<HTMLInputElement | null>;
  handleOtherInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  noneOption: SingleSelectOption | undefined;
  noneMatchesSearch: boolean;
  hasNoResults: boolean;
  options: SingleSelectOption[];
}

function SingleSelectDropdownVariant({
  inputId,
  dir,
  disabled,
  errorMessage,
  placeholder,
  selectedValue,
  effectiveSelectedValue,
  setPendingDropdownValue,
  setHasPendingDropdownChange,
  handleDropdownOpenChange,
  contentRef,
  lockedSide,
  showSearch,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  searchPlaceholder,
  searchNoResultsText,
  focusMenuItem,
  handleContentKeyDown,
  filteredRegularOptions,
  otherMatchesSearch,
  otherOptionId,
  otherOptionLabel,
  otherOptionPlaceholder,
  otherValue,
  isOtherSelected,
  otherInputRef,
  handleOtherInputChange,
  noneOption,
  noneMatchesSearch,
  hasNoResults,
  options,
}: Readonly<DropdownVariantProps>): React.JSX.Element {
  const selectedOption = options.find((opt) => opt.id === effectiveSelectedValue);
  const displayText = getDropdownDisplayText({
    isOtherSelected,
    otherValue,
    otherOptionLabel,
    selectedOptionLabel: selectedOption?.label,
    placeholder,
  });

  return (
    <>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <DropdownMenu onOpenChange={handleDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          {/* Named via aria-labelledby (headline + visible value) instead of aria-label:
              a rich-text headline would leak raw HTML into the accessible name, and the
              name must contain the visible text (WCAG 2.5.3 Label in Name). */}
          <Button
            variant="outline"
            disabled={disabled}
            className="rounded-input min-h-input bg-input-bg border-input-border text-input-text py-input-y px-input-x w-full justify-between"
            aria-invalid={Boolean(errorMessage)}
            aria-labelledby={`${inputId}-headline ${inputId}-trigger-value`}>
            <span
              id={`${inputId}-trigger-value`}
              className="font-input font-input-weight text-input-text truncate">
              {displayText}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          ref={contentRef}
          side={lockedSide}
          avoidCollisions={lockedSide === undefined}
          className="bg-option-bg border-input-border w-(--radix-dropdown-menu-trigger-width) overflow-hidden"
          align="start"
          onKeyDown={handleContentKeyDown}>
          {showSearch ? (
            <DropdownSearchInput
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchInputRef={searchInputRef}
              placeholder={searchPlaceholder}
              dir={dir}
              onNavigateToOptions={focusMenuItem}
            />
          ) : null}
          <div className="max-h-[260px] overflow-y-auto">
            <DropdownMenuRadioGroup
              value={effectiveSelectedValue}
              onValueChange={(newValue) => {
                setPendingDropdownValue(newValue);
                setHasPendingDropdownChange(newValue !== selectedValue);
              }}>
              {filteredRegularOptions.map((option) => (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  id={`${inputId}-${option.id}`}
                  dir={dir}
                  disabled={disabled}>
                  <span className="font-input font-input-weight text-input-text">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
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
              {noneOption && noneMatchesSearch ? (
                <DropdownMenuRadioItem
                  key={noneOption.id}
                  value={noneOption.id}
                  id={`${inputId}-${noneOption.id}`}
                  dir={dir}
                  disabled={disabled}>
                  <span className="font-input font-input-weight text-input-text">{noneOption.label}</span>
                </DropdownMenuRadioItem>
              ) : null}
              {hasNoResults ? (
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
          aria-required
          aria-invalid={Boolean(errorMessage)}
          dir={dir}
          className="mt-2 w-full"
        />
      ) : null}
    </>
  );
}

const getDropdownDisplayText = ({
  isOtherSelected,
  otherValue,
  otherOptionLabel,
  selectedOptionLabel,
  placeholder,
}: {
  isOtherSelected: boolean;
  otherValue: string;
  otherOptionLabel: string;
  selectedOptionLabel: string | undefined;
  placeholder: string;
}): string => {
  if (isOtherSelected) {
    return otherValue || otherOptionLabel;
  }
  return selectedOptionLabel ?? placeholder;
};

interface ListVariantProps {
  inputId: string;
  dir: Direction;
  disabled: boolean;
  errorMessage?: string;
  required: boolean;
  options: SingleSelectOption[];
  selectedValue: string | undefined;
  onChange: (value: string | undefined) => void;
  hasOtherOption: boolean;
  otherOptionId?: string;
  otherOptionLabel: string;
  otherOptionPlaceholder: string;
  otherValue: string;
  isOtherSelected: boolean;
  otherInputRef: React.RefObject<HTMLInputElement | null>;
  handleOtherInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const OPTION_LABEL_CLASS = "font-option text-option font-option-weight text-option-label";

function getOptionContainerClassName(isSelected: boolean, disabled: boolean): string {
  return cn(
    "relative flex cursor-pointer flex-col border transition-colors outline-none",
    "rounded-option px-option-x py-option-y",
    isSelected ? "bg-option-selected-bg border-brand" : "bg-option-bg border-option-border",
    "focus-within:border-brand focus-within:bg-option-selected-bg",
    "hover:bg-option-hover-bg",
    disabled && "cursor-not-allowed opacity-50"
  );
}

/**
 * Custom radio indicator driven by the sibling native input's :checked state via the Tailwind
 * `peer` utility. The native <input type="radio"> is visually hidden (sr-only) but stays in the
 * DOM as the real, focusable control; this span only paints the dot.
 */
function RadioIndicator(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "border-input-border relative flex size-4 shrink-0 items-center justify-center rounded-full border bg-white shadow-xs transition-colors",
        "peer-checked:border-brand",
        "after:size-2 after:rounded-full after:bg-transparent after:transition-colors after:content-['']",
        "peer-checked:after:bg-brand"
      )}
    />
  );
}

type GetRadioProps = ReturnType<typeof useRovingRadioGroup>["getRadioProps"];

interface SingleSelectOptionItemProps {
  inputId: string;
  option: SingleSelectOption;
  isSelected: boolean;
  disabled: boolean;
  required: boolean;
  dir: Direction;
  onSelect: (optionId: string) => void;
  onDeselect: (optionId: string) => void;
  getRadioProps: GetRadioProps;
}

function SingleSelectOptionItem({
  inputId,
  option,
  isSelected,
  disabled,
  required,
  dir,
  onSelect,
  onDeselect,
  getRadioProps,
}: Readonly<SingleSelectOptionItemProps>): React.JSX.Element {
  const optionId = `${inputId}-${option.id}`;

  return (
    <label
      key={option.id}
      dir={dir}
      htmlFor={optionId}
      className={cn(getOptionContainerClassName(isSelected, disabled), isSelected && "z-10")}>
      <span className="flex items-center">
        <input
          type="radio"
          id={optionId}
          name={inputId}
          value={option.id}
          checked={isSelected}
          disabled={disabled}
          className="peer sr-only"
          onChange={() => {
            onSelect(option.id);
          }}
          onClick={() => {
            // Native radios cannot be unchecked by re-clicking; allow deselect when not required.
            if (!required && isSelected) {
              onDeselect(option.id);
            }
          }}
          {...getRadioProps(option.id)}
        />
        <RadioIndicator />
        <span className={cn("mx-3 grow", OPTION_LABEL_CLASS)}>{option.label}</span>
      </span>
    </label>
  );
}

function SingleSelectListVariant({
  inputId,
  dir,
  disabled,
  errorMessage,
  required,
  options,
  selectedValue,
  onChange,
  hasOtherOption,
  otherOptionId,
  otherOptionLabel,
  otherOptionPlaceholder,
  otherValue,
  isOtherSelected,
  otherInputRef,
  handleOtherInputChange,
}: Readonly<ListVariantProps>): React.JSX.Element {
  const regularOptions = options.filter((option) => option.id !== "none");
  const noneOptions = options.filter((option) => option.id === "none");

  const handleSelect = (optionId: string): void => {
    onChange(optionId);
  };

  const handleDeselect = (optionId: string): void => {
    if (selectedValue === optionId) {
      onChange(undefined);
    }
  };

  // All radios of the group in DOM order: regular options, then "other", then "none".
  const orderedValues = [
    ...regularOptions.map((option) => option.id),
    ...(hasOtherOption && otherOptionId ? [otherOptionId] : []),
    ...noneOptions.map((option) => option.id),
  ];
  const { getRadioProps } = useRovingRadioGroup({
    values: orderedValues,
    selectedValue,
    onSelect: handleSelect,
  });

  const renderOption = (option: SingleSelectOption): React.JSX.Element => (
    <SingleSelectOptionItem
      key={option.id}
      inputId={inputId}
      option={option}
      isSelected={selectedValue === option.id}
      disabled={disabled}
      required={required}
      dir={dir}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      getRadioProps={getRadioProps}
    />
  );

  return (
    <div className="relative" data-element-input>
      <ElementError errorMessage={errorMessage} dir={dir} />
      <div className="w-full space-y-2">
        {regularOptions.map(renderOption)}
        {hasOtherOption && otherOptionId ? (
          <OtherOptionLabel
            inputId={inputId}
            otherOptionId={otherOptionId}
            otherOptionLabel={otherOptionLabel}
            otherOptionPlaceholder={otherOptionPlaceholder}
            otherValue={otherValue}
            isOtherSelected={isOtherSelected}
            otherInputRef={otherInputRef}
            handleOtherInputChange={handleOtherInputChange}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            dir={dir}
            disabled={disabled}
            required={required}
            errorMessage={errorMessage}
            getRadioProps={getRadioProps}
          />
        ) : null}
        {noneOptions.map(renderOption)}
      </div>
    </div>
  );
}

interface OtherOptionLabelProps {
  inputId: string;
  otherOptionId: string;
  otherOptionLabel: string;
  otherOptionPlaceholder: string;
  otherValue: string;
  isOtherSelected: boolean;
  otherInputRef: React.RefObject<HTMLInputElement | null>;
  handleOtherInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (optionId: string) => void;
  onDeselect: (optionId: string) => void;
  dir: Direction;
  disabled: boolean;
  required: boolean;
  errorMessage?: string;
  getRadioProps: GetRadioProps;
}

function OtherOptionLabel({
  inputId,
  otherOptionId,
  otherOptionLabel,
  otherOptionPlaceholder,
  otherValue,
  isOtherSelected,
  otherInputRef,
  handleOtherInputChange,
  onSelect,
  onDeselect,
  dir,
  disabled,
  required,
  errorMessage,
  getRadioProps,
}: Readonly<OtherOptionLabelProps>): React.JSX.Element {
  const optionId = `${inputId}-${otherOptionId}`;
  const otherTextId = `${optionId}-input`;

  return (
    // The free-text input must NOT live inside the option <label>: a label may own only one
    // labelable control, and label-area clicks would forward to the radio and deselect "Other".
    // The bordered box is a plain container; only the option row is the radio's label.
    <div
      dir={dir}
      className={cn(getOptionContainerClassName(isOtherSelected, disabled), isOtherSelected && "z-10")}>
      <label htmlFor={optionId} className="flex cursor-pointer items-center">
        <input
          type="radio"
          id={optionId}
          name={inputId}
          value={otherOptionId}
          checked={isOtherSelected}
          disabled={disabled}
          className="peer sr-only"
          onChange={() => {
            onSelect(otherOptionId);
          }}
          onClick={() => {
            if (!required && isOtherSelected) {
              onDeselect(otherOptionId);
            }
          }}
          {...getRadioProps(otherOptionId)}
        />
        <RadioIndicator />
        <span className={cn("mr-3 ml-3 grow", OPTION_LABEL_CLASS)}>{otherOptionLabel}</span>
      </label>
      {isOtherSelected ? (
        <Input
          ref={otherInputRef}
          id={otherTextId}
          type="text"
          value={otherValue}
          onChange={handleOtherInputChange}
          placeholder={otherOptionPlaceholder}
          disabled={disabled}
          aria-required
          aria-label={otherOptionLabel}
          aria-invalid={Boolean(errorMessage)}
          dir={dir}
          className="mt-2 w-full"
        />
      ) : null}
    </div>
  );
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
  const selectedValue = value ?? undefined;
  const hasOtherOption = Boolean(otherOptionId);
  const isOtherSelected = hasOtherOption && selectedValue === otherOptionId;
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  const allDropdownOptionCount = options.length + (hasOtherOption ? 1 : 0);
  const showSearch = variant === "dropdown" && allDropdownOptionCount > SEARCH_THRESHOLD;

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
    focusMenuItem,
    handleContentKeyDown,
  } = useDropdownSearch({ options, hasOtherOption, otherOptionLabel, isSearchEnabled: showSearch });

  const {
    effectiveSelectedValue,
    handleDropdownOpenChange,
    setPendingDropdownValue,
    setHasPendingDropdownChange,
  } = useDropdownCommitState({
    variant,
    selectedValue,
    onChange,
    handleDropdownOpen,
    handleDropdownClose,
  });

  React.useEffect(() => {
    if (!isOtherSelected || disabled) return;

    // Delay focus to win against focus restoration when dropdown closes / radio receives focus.
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

  // The list variant groups options in a native <fieldset>/<legend>; the dropdown variant keeps a
  // standard headline -> trigger association via ElementHeader's default rendering.
  const isListVariant = variant === "list";

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {isListVariant ? (
        // role="radiogroup" makes aria-required/aria-invalid valid on the group (a bare
        // <fieldset> is role="group", which supports neither). The group is named by its headline
        // via aria-labelledby instead of a <legend>, so the headline's media/required badge are
        // not nested in invalid block content.
        <fieldset
          className="w-full space-y-4"
          role="radiogroup"
          aria-labelledby={`${inputId}-headline`}
          aria-required={required}
          aria-invalid={Boolean(errorMessage)}>
          <ElementHeader
            headlineId={`${inputId}-headline`}
            headline={headline}
            description={description}
            required={required}
            requiredLabel={requiredLabel}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
          />
          <SingleSelectListVariant
            inputId={inputId}
            dir={dir}
            disabled={disabled}
            errorMessage={errorMessage}
            required={required}
            options={options}
            selectedValue={selectedValue}
            onChange={onChange}
            hasOtherOption={hasOtherOption}
            otherOptionId={otherOptionId}
            otherOptionLabel={otherOptionLabel}
            otherOptionPlaceholder={otherOptionPlaceholder}
            otherValue={otherValue}
            isOtherSelected={isOtherSelected}
            otherInputRef={otherInputRef}
            handleOtherInputChange={handleOtherInputChange}
          />
        </fieldset>
      ) : (
        <>
          {/* Dropdown trigger is a Radix menu button named via aria-labelledby (headline id +
              visible value id); the headline is a plain label here (no htmlFor) to avoid
              pointing at a non-input. */}
          <ElementHeader
            headlineId={`${inputId}-headline`}
            headline={headline}
            description={description}
            required={required}
            requiredLabel={requiredLabel}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
          />
          <div data-element-input>
            <SingleSelectDropdownVariant
              inputId={inputId}
              dir={dir}
              disabled={disabled}
              errorMessage={errorMessage}
              placeholder={placeholder}
              selectedValue={selectedValue}
              effectiveSelectedValue={effectiveSelectedValue}
              setPendingDropdownValue={setPendingDropdownValue}
              setHasPendingDropdownChange={setHasPendingDropdownChange}
              handleDropdownOpenChange={handleDropdownOpenChange}
              contentRef={contentRef}
              lockedSide={lockedSide}
              showSearch={showSearch}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchInputRef={searchInputRef}
              searchPlaceholder={searchPlaceholder}
              searchNoResultsText={searchNoResultsText}
              focusMenuItem={focusMenuItem}
              handleContentKeyDown={handleContentKeyDown}
              filteredRegularOptions={filteredRegularOptions}
              otherMatchesSearch={otherMatchesSearch}
              otherOptionId={otherOptionId}
              otherOptionLabel={otherOptionLabel}
              otherOptionPlaceholder={otherOptionPlaceholder}
              otherValue={otherValue}
              isOtherSelected={isOtherSelected}
              otherInputRef={otherInputRef}
              handleOtherInputChange={handleOtherInputChange}
              noneOption={noneOption}
              noneMatchesSearch={noneMatchesSearch}
              hasNoResults={hasNoResults}
              options={options}
            />
          </div>
        </>
      )}
    </div>
  );
}

export { SingleSelect };
export type { SingleSelectProps };

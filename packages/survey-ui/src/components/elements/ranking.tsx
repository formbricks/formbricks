import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { ElementError, getElementErrorAria } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { FB_PART } from "@/lib/parts";
import { cn } from "@/lib/utils";

/**
 * Text direction type for ranking element
 */
type TextDirection = "ltr" | "rtl" | "auto";

/**
 * Option for ranking element
 */
export interface RankingOption {
  /** Unique identifier for the option */
  id: string;
  /** Display label for the option */
  label: string;
}

interface RankingProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the ranking group */
  inputId: string;
  /** Array of options to rank */
  options: RankingOption[];
  /** Currently ranked option IDs in order (array of option IDs) */
  value?: string[];
  /** Callback function called when ranking changes */
  onChange: (value: string[]) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: TextDirection;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Alt text for the image; empty or absent marks it decorative */
  imageAltText?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
  /** ID of the 'other' option; once it is ranked, a free-text input appears inside its item */
  otherOptionId?: string;
  /** Placeholder text for the 'other' input field */
  otherOptionPlaceholder?: string;
  /** Custom value entered in the 'other' input field */
  otherValue?: string;
  /** Callback when the 'other' input value changes */
  onOtherValueChange?: (value: string) => void;
}

interface RankingOtherInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  errorMessage?: string;
  inputId: string;
  dir?: TextDirection;
}

interface RankingItemProps {
  item: RankingOption;
  rankedIds: string[];
  onItemClick: (item: RankingOption) => void;
  onMove: (itemId: string, direction: "up" | "down") => void;
  disabled: boolean;
  dir?: TextDirection;
  otherInput?: RankingOtherInputProps;
}

function RankingOtherInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  errorMessage,
  inputId,
  dir,
}: Readonly<RankingOtherInputProps>): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorAria = getElementErrorAria(inputId, errorMessage);

  // Mounts exactly when "Other" gets ranked, so move focus straight into the text box.
  React.useEffect(() => {
    if (disabled) return;
    const timeoutId = globalThis.setTimeout(() => {
      globalThis.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [disabled]);

  // The enclosing <fieldset> carries aria-describedby, but an ancestor's description is not part of
  // a descendant's accessible description, so the input needs its own link to the error message.
  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.currentTarget.value);
      }}
      placeholder={placeholder}
      disabled={disabled}
      aria-required
      aria-label={label}
      aria-invalid={errorAria.ariaInvalid}
      aria-describedby={errorAria.ariaDescribedBy}
      dir={dir}
      className="w-full"
    />
  );
}

function RankingItem({
  item,
  rankedIds,
  onItemClick,
  onMove,
  disabled,
  dir,
  otherInput,
}: Readonly<RankingItemProps>): React.ReactNode {
  const isRanked = rankedIds.includes(item.id);
  const rankIndex = rankedIds.indexOf(item.id);
  const isFirst = isRanked && rankIndex === 0;
  const isLast = isRanked && rankIndex === rankedIds.length - 1;
  const displayNumber = isRanked ? rankIndex + 1 : undefined;

  return (
    // Hooked as an option for its box. A ranked item has no native/ARIA state to style from (the
    // toggle's label already says "Remove … from ranking"), so the ranked look stays built in.
    <li
      dir={dir}
      data-fb-part={FB_PART.option}
      data-checked={isRanked ? "true" : undefined}
      className={cn(
        "rounded-option flex min-h-12 cursor-pointer flex-col border px-3 transition-all",
        "bg-option-bg border-option-border",
        // No focus-within fill: it repainted the item in the *ranked* colors, so the card's mount
        // autofocus made the first item look already ranked (ENG-2288). Focus has its own uniform
        // ring, painted on the item's button by survey-ui's globals.css.
        "hover:bg-option-hover-bg",
        isRanked && "bg-option-selected-bg border-brand",
        disabled && "cursor-not-allowed opacity-50"
      )}>
      <div className="flex h-12 items-center">
        <button
          type="button"
          onClick={() => {
            onItemClick(item);
          }}
          disabled={disabled}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onItemClick(item);
            }
          }}
          className="group flex h-full grow items-center gap-4 text-start focus:outline-none"
          aria-label={isRanked ? `Remove ${item.label} from ranking` : `Add ${item.label} to ranking`}>
          <span
            data-fb-part={FB_PART.optionControl}
            className={cn(
              "border-brand flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              isRanked
                ? "bg-brand text-white"
                : "group-hover:bg-background group-hover:text-foreground border-dashed text-transparent"
            )}>
            {displayNumber}
          </span>
          <span
            data-fb-part={FB_PART.optionLabel}
            className="font-option text-option font-option-weight text-option-label shrink grow text-start">
            {item.label}
          </span>
        </button>

        {/* Up/Down buttons for ranked items */}
        {isRanked ? (
          <div className={cn("border-option-border -mx-3 flex h-full grow-0 flex-col")} dir={dir}>
            <button
              type="button"
              tabIndex={isFirst ? -1 : 0}
              onClick={(e) => {
                e.preventDefault();
                onMove(item.id, "up");
              }}
              disabled={isFirst || disabled}
              aria-label={`Move ${item.label} up`}
              className={cn("flex flex-1 items-center justify-center px-2 transition-colors")}>
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              type="button"
              tabIndex={isLast ? -1 : 0}
              onClick={(e) => {
                e.preventDefault();
                onMove(item.id, "down");
              }}
              disabled={isLast || disabled}
              aria-label={`Move ${item.label} down`}
              className={cn(
                "border-option-border flex flex-1 items-center justify-center border-t px-2 transition-colors"
              )}>
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
      {/* The free-text input sits outside the item's <button>: interactive content may not nest
          inside a button, and clicks in the text box must not toggle "Other" out of the ranking. */}
      {isRanked && otherInput ? (
        <div className="pb-3">
          <RankingOtherInput {...otherInput} />
        </div>
      ) : null}
    </li>
  );
}

function Ranking({
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
  imageUrl,
  imageAltText,
  videoUrl,
  otherOptionId,
  otherOptionPlaceholder = "Please specify",
  otherValue = "",
  onOtherValueChange,
}: Readonly<RankingProps>): React.JSX.Element {
  const errorAria = getElementErrorAria(inputId, errorMessage);

  // Ensure value is always an array
  const rankedIds = React.useMemo(() => (Array.isArray(value) ? value : []), [value]);

  // Get sorted (ranked) items and unsorted items
  const sortedItems = React.useMemo(() => {
    return rankedIds
      .map((id) => options.find((opt) => opt.id === id))
      .filter((item): item is RankingOption => item !== undefined);
  }, [rankedIds, options]);

  const unsortedItems = React.useMemo(() => {
    return options.filter((opt) => !rankedIds.includes(opt.id));
  }, [options, rankedIds]);

  // Handle item click (add to ranking or remove from ranking)
  const handleItemClick = (item: RankingOption): void => {
    if (disabled) return;

    const isAlreadyRanked = rankedIds.includes(item.id);
    const newRankedIds = isAlreadyRanked ? rankedIds.filter((id) => id !== item.id) : [...rankedIds, item.id];

    onChange(newRankedIds);
  };

  // Handle move up/down
  const handleMove = (itemId: string, direction: "up" | "down"): void => {
    if (disabled) return;

    const index = rankedIds.indexOf(itemId);
    if (index === -1) return;

    const newRankedIds = [...rankedIds];
    const [movedItem] = newRankedIds.splice(index, 1);
    const newIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(newRankedIds.length, index + 1);
    newRankedIds.splice(newIndex, 0, movedItem);

    onChange(newRankedIds);
  };

  // Combine sorted and unsorted items for display
  const allItems = [...sortedItems, ...unsortedItems];

  // Animation ref for smooth transitions
  const [parent] = useAutoAnimate();

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
        imageAltText={imageAltText}
        videoUrl={videoUrl}
      />

      {/* Ranking Options */}
      <div className="relative" data-element-input>
        <ElementError errorMessage={errorMessage} dir={dir} id={errorAria.errorId} />
        {/* The <fieldset> is role="group", which ARIA 1.2 gives neither aria-required nor
            aria-invalid (aria-invalid was global in ARIA 1.1 but is not in 1.2). The items are
            reorder buttons in an <ol>, not radios, so there is no accurate role that does support
            them. The visible "Required" badge conveys requiredness; the invalid state is announced
            by the live region above plus the focus move, and aria-invalid stays only as a
            best-effort machine-readable hook. */}
        <fieldset
          className="w-full"
          dir={dir}
          aria-invalid={errorAria.ariaInvalid}
          aria-describedby={errorAria.ariaDescribedBy}>
          <legend className="sr-only">Ranking options</legend>
          {/* Semantic ordered list so screen readers announce rank position and count;
              role="list" is kept explicitly because list-style removal (Tailwind preflight)
              makes Safari/VoiceOver drop implicit list semantics. */}
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari/VoiceOver needs the explicit role once list-style is none */}
          <ol role="list" className="list-none space-y-2" ref={parent}>
            {allItems.map((item) => (
              <RankingItem
                key={item.id}
                item={item}
                rankedIds={rankedIds}
                onItemClick={handleItemClick}
                onMove={handleMove}
                disabled={disabled}
                dir={dir}
                otherInput={
                  item.id === otherOptionId && onOtherValueChange
                    ? {
                        label: item.label,
                        placeholder: otherOptionPlaceholder,
                        value: otherValue,
                        onChange: onOtherValueChange,
                        disabled,
                        errorMessage,
                        inputId,
                        dir,
                      }
                    : undefined
                }
              />
            ))}
          </ol>
        </fieldset>
      </div>
    </div>
  );
}

export { Ranking };
export type { RankingProps };

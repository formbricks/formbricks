import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
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
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: TextDirection;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

interface RankingItemProps {
  item: RankingOption;
  rankedIds: string[];
  onItemClick: (item: RankingOption) => void;
  onMove: (itemId: string, direction: "up" | "down") => void;
  disabled: boolean;
  dir?: TextDirection;
}

function getTopButtonRadiusClass(isFirst: boolean, dir?: TextDirection): string {
  if (isFirst) {
    return "cursor-not-allowed opacity-30";
  }
  if (dir === "rtl") {
    return "rounded-tl-md";
  }
  return "rounded-tr-md";
}

function getBottomButtonRadiusClass(isLast: boolean, dir?: TextDirection): string {
  if (isLast) {
    return "cursor-not-allowed opacity-30";
  }
  if (dir === "rtl") {
    return "rounded-bl-md";
  }
  return "rounded-br-md";
}

function RankingItem({
  item,
  rankedIds,
  onItemClick,
  onMove,
  disabled,
  dir,
}: Readonly<RankingItemProps>): React.ReactNode {
  const isRanked = rankedIds.includes(item.id);
  const rankIndex = rankedIds.indexOf(item.id);
  const isFirst = isRanked && rankIndex === 0;
  const isLast = isRanked && rankIndex === rankedIds.length - 1;
  const displayNumber = isRanked ? rankIndex + 1 : undefined;

  // RTL-aware padding class
  const paddingClass = dir === "rtl" ? "pr-3" : "pl-3";

  // RTL-aware border class for control buttons
  const borderClass = dir === "rtl" ? "border-r" : "border-l";

  // RTL-aware border radius classes for control buttons
  const topButtonRadiusClass = getTopButtonRadiusClass(isFirst, dir);
  const bottomButtonRadiusClass = getBottomButtonRadiusClass(isLast, dir);

  return (
    <div
      className={cn(
        "rounded-option flex h-12 cursor-pointer items-center border transition-all",
        paddingClass,
        "bg-option-bg border-option-border",
        "hover:bg-option-hover-bg focus-within:border-brand focus-within:bg-option-selected-bg focus-within:shadow-sm",
        isRanked && "bg-option-selected-bg border-brand",
        disabled && "cursor-not-allowed opacity-50"
      )}>
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
          className={cn(
            "border-brand flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            isRanked
              ? "bg-brand text-white"
              : "group-hover:bg-background group-hover:text-foreground border-dashed text-transparent"
          )}>
          {displayNumber}
        </span>
        <span
          className="font-option text-option font-option-weight text-option-label shrink grow text-start"
          dir={dir}>
          {item.label}
        </span>
      </button>

      {/* Up/Down buttons for ranked items */}
      {isRanked ? (
        <div className={cn("border-option-border flex h-full grow-0 flex-col", borderClass)}>
          <button
            type="button"
            tabIndex={isFirst ? -1 : 0}
            onClick={(e) => {
              e.preventDefault();
              onMove(item.id, "up");
            }}
            disabled={isFirst || disabled}
            aria-label={`Move ${item.label} up`}
            className={cn(
              "flex flex-1 items-center justify-center px-2 transition-colors",
              topButtonRadiusClass
            )}>
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
              "border-option-border flex flex-1 items-center justify-center border-t px-2 transition-colors",
              bottomButtonRadiusClass
            )}>
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
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
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
}: Readonly<RankingProps>): React.JSX.Element {
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
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* Ranking Options */}
      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />

        <fieldset className="w-full" dir={dir}>
          <legend className="sr-only">Ranking options</legend>
          <div className="space-y-2" ref={parent as React.Ref<HTMLDivElement>}>
            {allItems.map((item) => (
              <RankingItem
                key={item.id}
                item={item}
                rankedIds={rankedIds}
                onItemClick={handleItemClick}
                onMove={handleMove}
                disabled={disabled}
                dir={dir}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

export { Ranking };
export type { RankingProps };

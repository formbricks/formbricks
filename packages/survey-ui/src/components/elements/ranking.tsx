import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { useTextDirection } from "@/hooks/use-text-direction";
import { cn } from "@/lib/utils";

/**
 * Option for ranking question
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
  /** The main question or prompt text displayed as the headline */
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
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the controls are disabled */
  disabled?: boolean;
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
}: RankingProps): React.JSX.Element {
  // Ensure value is always an array
  const rankedIds = Array.isArray(value) ? value : [];

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? "", ...options.map((opt) => opt.label)],
  });

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

    const index = rankedIds.findIndex((id) => id === itemId);
    if (index === -1) return;

    const newRankedIds = [...rankedIds];
    const [movedItem] = newRankedIds.splice(index, 1);
    const newIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(newRankedIds.length, index + 1);
    newRankedIds.splice(newIndex, 0, movedItem);

    onChange(newRankedIds);
  };

  // Combine sorted and unsorted items for display
  const allItems = [...sortedItems, ...unsortedItems];

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Ranking Options */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={detectedDir} />

        <fieldset className="w-full">
          <legend className="sr-only">Ranking options</legend>
          <div className="space-y-2">
            {allItems.map((item) => {
              const isRanked = rankedIds.includes(item.id);
              const rankIndex = rankedIds.findIndex((id) => id === item.id);
              const isFirst = isRanked && rankIndex === 0;
              const isLast = isRanked && rankIndex === rankedIds.length - 1;
              const displayNumber = isRanked ? rankIndex + 1 : undefined;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex h-12 cursor-pointer items-center rounded-md border transition-all",
                    "hover:bg-accent focus-within:border-primary focus-within:bg-accent focus-within:shadow-sm",
                    isRanked && "bg-accent border-primary",
                    disabled && "cursor-not-allowed opacity-50"
                  )}>
                  <button
                    type="button"
                    onClick={() => {
                      handleItemClick(item);
                    }}
                    disabled={disabled}
                    onKeyDown={(e) => {
                      if (disabled) return;
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    className="group flex h-full grow items-center gap-4 px-4 text-left focus:outline-none"
                    aria-label={
                      isRanked ? `Remove ${item.label} from ranking` : `Add ${item.label} to ranking`
                    }>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        isRanked
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input group-hover:bg-background group-hover:text-foreground border-dashed text-transparent"
                      )}>
                      {displayNumber}
                    </span>
                    <span className="shrink grow text-start text-sm font-medium" dir={detectedDir}>
                      {item.label}
                    </span>
                  </button>

                  {/* Up/Down buttons for ranked items */}
                  {isRanked ? (
                    <div className="border-input flex h-full grow-0 flex-col border-l">
                      <button
                        type="button"
                        tabIndex={isFirst ? -1 : 0}
                        onClick={(e) => {
                          e.preventDefault();
                          handleMove(item.id, "up");
                        }}
                        disabled={isFirst || disabled}
                        aria-label={`Move ${item.label} up`}
                        className={cn(
                          "flex flex-1 items-center justify-center px-2 transition-colors",
                          isFirst ? "cursor-not-allowed opacity-30" : "hover:bg-accent rounded-tr-md"
                        )}>
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        tabIndex={isLast ? -1 : 0}
                        onClick={(e) => {
                          e.preventDefault();
                          handleMove(item.id, "down");
                        }}
                        disabled={isLast || disabled}
                        aria-label={`Move ${item.label} down`}
                        className={cn(
                          "border-input flex flex-1 items-center justify-center border-t px-2 transition-colors",
                          isLast ? "cursor-not-allowed opacity-30" : "hover:bg-accent rounded-br-md"
                        )}>
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

export { Ranking };
export type { RankingProps };

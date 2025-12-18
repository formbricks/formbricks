import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Label } from "@/components/general/label";
import { cn } from "@/lib/utils";

interface NPSProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the NPS group */
  inputId: string;
  /** Currently selected NPS value (0 to 10) */
  value?: number;
  /** Callback function called when NPS value changes */
  onChange: (value: number) => void;
  /** Optional label for the lower end of the scale */
  lowerLabel?: string;
  /** Optional label for the upper end of the scale */
  upperLabel?: string;
  /** Whether color coding is enabled */
  colorCoding?: boolean;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

function NPS({
  elementId,
  headline,
  description,
  inputId,
  value,
  onChange,
  lowerLabel,
  upperLabel,
  colorCoding = false,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
}: Readonly<NPSProps>): React.JSX.Element {
  const [hoveredValue, setHoveredValue] = React.useState<number | null>(null);

  // Ensure value is within valid range (0-10)
  const currentValue = value !== undefined && value >= 0 && value <= 10 ? value : undefined;

  // Handle NPS selection
  const handleSelect = (npsValue: number): void => {
    if (!disabled) {
      onChange(npsValue);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (npsValue: number) => (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(npsValue);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const direction = e.key === "ArrowLeft" ? -1 : 1;
      const newValue = Math.max(0, Math.min(10, (currentValue ?? 0) + direction));
      handleSelect(newValue);
    }
  };

  // Get NPS option color for color coding
  const getNPSOptionColor = (idx: number): string => {
    if (idx > 8) return "bg-emerald-100"; // 9-10: Promoters (green)
    if (idx > 6) return "bg-orange-100"; // 7-8: Passives (orange)
    return "bg-rose-100"; // 0-6: Detractors (red)
  };

  // Render NPS option (0-10)
  const renderNPSOption = (number: number): React.JSX.Element => {
    const isSelected = currentValue === number;
    const isHovered = hoveredValue === number;
    const isLast = number === 10; // Last option is 10
    const isFirst = number === 0; // First option is 0

    // Determine border radius and border classes
    // Use right border for all items to create separators, left border only on first item
    let borderRadiusClasses = "";
    let borderClasses = "border-t border-b border-r";

    if (isFirst) {
      borderRadiusClasses = dir === "rtl" ? "rounded-r-input" : "rounded-l-input";
      borderClasses = "border-t border-b border-l border-r";
    } else if (isLast) {
      borderRadiusClasses = dir === "rtl" ? "rounded-l-input" : "rounded-r-input";
      // Last item keeps right border for rounded corner
    }

    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- label is interactive
      <label
        key={number}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown(number)}
        className={cn(
          "text-input-text font-input font-input-weight relative flex w-full cursor-pointer items-center justify-center overflow-hidden transition-colors focus:outline-none",
          borderClasses,
          isSelected
            ? "bg-brand-20 border-brand z-10 -ml-[1px] border-2 first:ml-0"
            : "border-input-border bg-input-bg",
          borderRadiusClasses,
          isHovered && !isSelected && "bg-input-selected-bg",
          colorCoding ? "min-h-[47px]" : "min-h-[41px]",
          disabled && "cursor-not-allowed opacity-50",
          "focus:border-brand focus:border-2"
        )}
        onMouseEnter={() => {
          if (!disabled) {
            setHoveredValue(number);
          }
        }}
        onMouseLeave={() => {
          setHoveredValue(null);
        }}
        onFocus={() => {
          if (!disabled) {
            setHoveredValue(number);
          }
        }}
        onBlur={() => {
          setHoveredValue(null);
        }}>
        {colorCoding ? (
          <div className={cn("absolute top-0 left-0 h-[6px] w-full", getNPSOptionColor(number))} />
        ) : null}
        <input
          type="radio"
          name={inputId}
          value={number}
          checked={isSelected}
          onChange={() => {
            handleSelect(number);
          }}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-label={`Rate ${String(number)} out of 10`}
        />
        <span className="text-sm">{number}</span>
      </label>
    );
  };

  // Generate NPS options (0-10)
  const npsOptions = Array.from({ length: 11 }, (_, i) => i);

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

      {/* NPS Options */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={dir} />
        <fieldset className="w-full px-[2px]">
          <legend className="sr-only">NPS rating options</legend>
          <div className="flex w-full">{npsOptions.map((number) => renderNPSOption(number))}</div>

          {/* Labels */}
          {(lowerLabel ?? upperLabel) ? (
            <div className="mt-2 flex justify-between gap-8 px-1.5">
              {lowerLabel ? (
                <Label variant="default" className="max-w-[50%] text-xs leading-6" dir={dir}>
                  {lowerLabel}
                </Label>
              ) : null}
              {upperLabel ? (
                <Label variant="default" className="max-w-[50%] text-right text-xs leading-6" dir={dir}>
                  {upperLabel}
                </Label>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      </div>
    </div>
  );
}

export { NPS };
export type { NPSProps };

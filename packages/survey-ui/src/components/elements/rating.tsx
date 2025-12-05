import { AlertCircle, Star } from "lucide-react";
import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { ElementHeader } from "../general/element-header";
import { Label } from "../general/label";
import {
  ConfusedFace,
  FrowningFace,
  GrinningFaceWithSmilingEyes,
  GrinningSquintingFace,
  NeutralFace,
  PerseveringFace,
  SlightlySmilingFace,
  SmilingFaceWithSmilingEyes,
  TiredFace,
  WearyFace,
} from "../general/smileys";

/**
 * Get smiley color class based on range and index
 */
const getSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "fill-emerald-100";
    if (range - idx < 5) return "fill-orange-100";
    return "fill-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "fill-emerald-100";
    if (range - idx < 3) return "fill-orange-100";
    return "fill-rose-100";
  }
  if (range - idx < 3) return "fill-emerald-100";
  if (range - idx < 4) return "fill-orange-100";
  return "fill-rose-100";
};

/**
 * Get active smiley color class based on range and index
 */
const getActiveSmileyColor = (range: number, idx: number) => {
  if (range > 5) {
    if (range - idx < 3) return "fill-emerald-300";
    if (range - idx < 5) return "fill-orange-300";
    return "fill-rose-300";
  } else if (range < 5) {
    if (range - idx < 2) return "fill-emerald-300";
    if (range - idx < 3) return "fill-orange-300";
    return "fill-rose-300";
  }
  if (range - idx < 3) return "fill-emerald-300";
  if (range - idx < 4) return "fill-orange-300";
  return "fill-rose-300";
};

/**
 * Get the appropriate smiley icon based on range and index
 */
const getSmileyIcon = (iconIdx: number, idx: number, range: number, active: boolean, addColors: boolean) => {
  const activeColor = addColors ? getActiveSmileyColor(range, idx) : "fill-primary";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "fill-none";

  const icons = [
    <TiredFace key="tired-face" className={active ? activeColor : inactiveColor} />,
    <WearyFace key="weary-face" className={active ? activeColor : inactiveColor} />,
    <PerseveringFace key="persevering-face" className={active ? activeColor : inactiveColor} />,
    <FrowningFace key="frowning-face" className={active ? activeColor : inactiveColor} />,
    <ConfusedFace key="confused-face" className={active ? activeColor : inactiveColor} />,
    <NeutralFace key="neutral-face" className={active ? activeColor : inactiveColor} />,
    <SlightlySmilingFace key="slightly-smiling-face" className={active ? activeColor : inactiveColor} />,
    <SmilingFaceWithSmilingEyes
      key="smiling-face-with-smiling-eyes"
      className={active ? activeColor : inactiveColor}
    />,
    <GrinningFaceWithSmilingEyes
      key="grinning-face-with-smiling-eyes"
      className={active ? activeColor : inactiveColor}
    />,
    <GrinningSquintingFace key="grinning-squinting-face" className={active ? activeColor : inactiveColor} />,
  ];
  return icons[iconIdx];
};

/**
 * Smiley component for rating scale
 */
const RatingSmiley = ({
  active,
  idx,
  range,
  addColors = false,
}: {
  active: boolean;
  idx: number;
  range: number;
  addColors?: boolean;
}) => {
  let iconsIdx: number[] = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 6) iconsIdx = [0, 2, 4, 5, 7, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];

  return getSmileyIcon(iconsIdx[idx], idx, range, active, addColors);
};

interface RatingProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the rating group */
  inputId: string;
  /** Rating scale type: 'number', 'star', or 'smiley' */
  scale: "number" | "star" | "smiley";
  /** Number of rating options (3, 4, 5, 6, 7, or 10) */
  range: 3 | 4 | 5 | 6 | 7 | 10;
  /** Currently selected rating value (1 to range) */
  value?: number;
  /** Callback function called when rating changes */
  onChange: (value: number) => void;
  /** Optional label for the lower end of the scale */
  lowerLabel?: string;
  /** Optional label for the upper end of the scale */
  upperLabel?: string;
  /** Whether color coding is enabled (for smiley scale) */
  colorCoding?: boolean;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the controls are disabled */
  disabled?: boolean;
}

function Rating({
  elementId,
  headline,
  description,
  inputId,
  scale,
  range,
  value,
  onChange,
  lowerLabel,
  upperLabel,
  colorCoding = false,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: RatingProps): React.JSX.Element {
  const [hoveredValue, setHoveredValue] = React.useState<number | null>(null);

  // Ensure value is within valid range
  const currentValue = value && value >= 1 && value <= range ? value : undefined;

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [headline, description ?? "", lowerLabel ?? "", upperLabel ?? ""],
  });

  // Handle rating selection
  const handleSelect = (ratingValue: number) => {
    if (!disabled) {
      onChange(ratingValue);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (ratingValue: number) => (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(ratingValue);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const direction = e.key === "ArrowLeft" ? -1 : 1;
      const newValue = Math.max(1, Math.min(range, (currentValue ?? 1) + direction));
      handleSelect(newValue);
    }
  };

  // Get number option color for color coding
  const getRatingNumberOptionColor = (range: number, idx: number) => {
    if (range > 5) {
      if (range - idx < 2) return "bg-emerald-100";
      if (range - idx < 4) return "bg-orange-100";
      return "bg-rose-100";
    } else if (range < 5) {
      if (range - idx < 1) return "bg-emerald-100";
      if (range - idx < 2) return "bg-orange-100";
      return "bg-rose-100";
    }
    if (range - idx < 2) return "bg-emerald-100";
    if (range - idx < 3) return "bg-orange-100";
    return "bg-rose-100";
  };

  // Render number scale option
  const renderNumberOption = (number: number, totalLength: number) => {
    const isSelected = currentValue === number;
    const isHovered = hoveredValue === number;
    const isLast = totalLength === number;
    const isFirst = number === 1;

    return (
      <label
        key={number}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown(number)}
        className={cn(
          "relative flex w-full cursor-pointer items-center justify-center overflow-hidden border-b border-l border-t transition-colors focus:border-2 focus:outline-none",
          isSelected ? "bg-accent border-primary z-10 border-2" : "border-input",
          isLast ? (detectedDir === "rtl" ? "rounded-l-md border-l" : "rounded-r-md border-r") : "",
          isFirst ? (detectedDir === "rtl" ? "rounded-r-md border-r" : "rounded-l-md border-l") : "",
          isHovered && !isSelected && "bg-accent/50",
          colorCoding ? "min-h-[47px]" : "min-h-[41px]",
          disabled && "cursor-not-allowed opacity-50",
          "focus:border-primary"
        )}
        onMouseEnter={() => !disabled && setHoveredValue(number)}
        onMouseLeave={() => setHoveredValue(null)}
        onFocus={() => !disabled && setHoveredValue(number)}
        onBlur={() => setHoveredValue(null)}>
        {colorCoding && (
          <div
            className={cn("absolute left-0 top-0 h-[6px] w-full", getRatingNumberOptionColor(range, number))}
          />
        )}
        <input
          type="radio"
          name={inputId}
          value={number}
          checked={isSelected}
          onChange={() => handleSelect(number)}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-label={`Rate ${number} out of ${range}`}
        />
        <span className="text-sm">{number}</span>
      </label>
    );
  };

  // Render star scale option
  const renderStarOption = (number: number) => {
    const isSelected = currentValue === number;
    const isHovered = hoveredValue === number;
    const isActive = isSelected || isHovered;

    return (
      <label
        key={number}
        className={cn(
          "flex min-h-[48px] flex-1 cursor-pointer items-center justify-center transition-opacity",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onMouseEnter={() => !disabled && setHoveredValue(number)}
        onMouseLeave={() => setHoveredValue(null)}
        onFocus={() => !disabled && setHoveredValue(number)}
        onBlur={() => setHoveredValue(null)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown(number)}>
        <input
          type="radio"
          name={inputId}
          value={number}
          checked={isSelected}
          onChange={() => handleSelect(number)}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-label={`Rate ${number} out of ${range} stars`}
        />
        <div className="flex w-full max-w-[74px] items-center justify-center">
          {isActive ? (
            <Star className="h-full w-full fill-yellow-400 text-yellow-400 transition-colors" />
          ) : (
            <Star className="h-full w-full text-slate-300 transition-colors" />
          )}
        </div>
      </label>
    );
  };

  // Render smiley scale option
  const renderSmileyOption = (number: number, index: number) => {
    const isSelected = currentValue === number;
    const isHovered = hoveredValue === number;
    const isActive = isSelected || isHovered;

    return (
      <label
        key={number}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown(number)}
        className={cn(
          "relative flex max-h-16 min-h-9 w-full cursor-pointer justify-center transition-colors focus:outline-none",
          isActive
            ? "stroke-primary text-primary"
            : "stroke-muted-foreground text-muted-foreground focus:border-accent focus:border-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onMouseEnter={() => !disabled && setHoveredValue(number)}
        onMouseLeave={() => setHoveredValue(null)}
        onFocus={() => !disabled && setHoveredValue(number)}
        onBlur={() => setHoveredValue(null)}>
        <input
          type="radio"
          name={inputId}
          value={number}
          checked={isSelected}
          onChange={() => handleSelect(number)}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-label={`Rate ${number} out of ${range}`}
        />
        <div className="h-full w-full max-w-[74px] object-contain">
          <RatingSmiley active={isActive} idx={index} range={range} addColors={colorCoding} />
        </div>
      </label>
    );
  };

  // Generate rating options
  const ratingOptions = Array.from({ length: range }, (_, i) => i + 1);

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Rating Options */}
      <div className="relative space-y-2">
        {/* Error indicator bar */}
        {errorMessage && <div className="bg-destructive absolute bottom-0 left-[-12px] top-0 w-[4px]" />}
        {/* Error message - shown at top */}
        {errorMessage && (
          <div className="text-destructive flex items-center gap-1 text-sm" dir={detectedDir}>
            <AlertCircle className="size-4" />
            <span>{errorMessage}</span>
          </div>
        )}
        <fieldset className="w-full">
          <legend className="sr-only">Rating options</legend>
          <div className="flex w-full">
            {ratingOptions.map((number, index) => {
              if (scale === "number") {
                return renderNumberOption(number, ratingOptions.length);
              } else if (scale === "star") {
                return renderStarOption(number);
              } else {
                return renderSmileyOption(number, index);
              }
            })}
          </div>

          {/* Labels */}
          {(lowerLabel || upperLabel) && (
            <div className="mt-4 flex justify-between gap-8 px-1.5">
              {lowerLabel && (
                <Label variant="default" className="max-w-[50%] text-xs leading-6" dir={detectedDir}>
                  {lowerLabel}
                </Label>
              )}
              {upperLabel && (
                <Label
                  variant="default"
                  className="max-w-[50%] text-right text-xs leading-6"
                  dir={detectedDir}>
                  {upperLabel}
                </Label>
              )}
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}

export { Rating };
export type { RatingProps };

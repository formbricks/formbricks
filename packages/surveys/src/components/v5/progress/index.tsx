import type { JSX } from "preact";

interface ProgressProps {
  value?: number;
  max?: number;
  containerStyling?: JSX.CSSProperties;
  indicatorStyling?: JSX.CSSProperties;
  "aria-label"?: string;
}

/**
 * Progress component displays an indicator showing the completion progress of a task.
 * Typically displayed as a progress bar.
 *
 * @param value - Current progress value (0-100 by default)
 * @param max - Maximum value (default: 100)
 * @param containerStyling - Custom styling object for the container
 * @param indicatorStyling - Custom styling object for the indicator
 * @param aria-label - Accessible label for the progress bar
 */
export function Progress({
  value = 0,
  max = 100,
  containerStyling = {},
  indicatorStyling = {},
  "aria-label": ariaLabel = "Progress",
}: ProgressProps) {
  // Calculate percentage, ensuring it stays within 0-100 range
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel}
      className="fb-relative fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full fb-bg-accent-bg"
      style={containerStyling}>
      <div
        className="fb-h-full fb-w-full fb-flex-1 fb-bg-brand fb-transition-all fb-duration-500 fb-ease-in-out"
        style={{
          transform: `translateX(-${100 - percentage}%)`,
          ...indicatorStyling,
        }}
      />
    </div>
  );
}

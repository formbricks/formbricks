import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Custom tokens from `packages/survey-ui/tailwind.config.ts`
      "font-size": ["text-input", "text-option", "text-button"],
      "font-weight": ["font-input-weight", "font-option-weight", "font-button-weight"],
      "text-color": ["text-input-text", "text-input-placeholder", "text-option-label", "text-button-text"],
    },
  },
});

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class merging
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// The renderer's sanitizers live in ./sanitize, a subpath the server can import without the UI bundle.
export { removeStyleAttributes, sanitizeSurveyHtml, stripInlineStyles } from "./sanitize";

/**
 * Generate RTL-aware border radius and border classes for rating/NPS scale options
 * Uses CSS logical properties that automatically adapt to text direction
 * @param isFirst - Whether this is the first item in the scale
 * @param isLast - Whether this is the last item in the scale
 * @returns Object containing borderRadiusClasses and borderClasses
 */
export const getRTLScaleOptionClasses = (
  isFirst: boolean,
  isLast: boolean
): { borderRadiusClasses: string; borderClasses: string } => {
  const borderRadiusClasses = cn(
    isFirst &&
      "[border-start-start-radius:var(--fb-input-border-radius)] [border-end-start-radius:var(--fb-input-border-radius)]",
    isLast &&
      "[border-start-end-radius:var(--fb-input-border-radius)] [border-end-end-radius:var(--fb-input-border-radius)]"
  );

  const borderClasses = cn(
    "border-t border-b border-e", // block borders (top/bottom) and inline-end border
    isFirst && "border-s" // inline-start border for first item
  );

  return { borderRadiusClasses, borderClasses };
};

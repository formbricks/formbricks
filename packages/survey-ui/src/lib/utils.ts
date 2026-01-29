import { type ClassValue, clsx } from "clsx";
import DOMPurify from "isomorphic-dompurify";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    // Custom tokens from `packages/survey-ui/tailwind.config.ts`
    fontSize: ["input", "option", "button"],
    textColor: ["input-text", "input-placeholder", "option-label", "button-text"],
  },
} as Parameters<typeof extendTailwindMerge>[0]);

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class merging
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * Uses DOMPurify for secure, proper HTML parsing instead of regex
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 */
export const stripInlineStyles = (html: string): string => {
  if (!html) return html;

  // Use DOMPurify to safely remove style attributes
  // This is more secure than regex-based approaches and handles edge cases properly
  return DOMPurify.sanitize(html, {
    FORBID_ATTR: ["style"],
    // Keep other attributes and tags as-is, only remove style attributes
    KEEP_CONTENT: true,
  });
};

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

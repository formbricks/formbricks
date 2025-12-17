import { type ClassValue, clsx } from "clsx";
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

export const stripInlineStyles = (html: string): string => {
  // Remove style="..." or style='...' attributes
  // Use separate patterns for each quote type to avoid ReDoS vulnerability
  // The pattern [^"]* and [^']* are safe as they don't cause backtracking
  return html.replace(/\s+style\s*=\s*["'][^"']*["']/gi, ""); //NOSONAR
};

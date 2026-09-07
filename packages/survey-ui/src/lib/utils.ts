import { type ClassValue, clsx } from "clsx";
import { addHook, removeHook, sanitize } from "isomorphic-dompurify";
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

/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * Uses DOMPurify for secure, proper HTML parsing instead of regex
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 */
export const stripInlineStyles = (html: string): string => {
  if (!html) return html;

  // Pre-strip style attributes from the raw string BEFORE DOMPurify parses it.
  // DOMPurify internally uses innerHTML to parse HTML, which triggers CSP
  // `style-src` violations at parse time — before FORBID_ATTR can strip them.
  // The regex is O(n) safe: [^"]* and [^']* are negated classes bounded by
  // fixed quote delimiters, so no backtracking can occur.
  const preStripped = html.replaceAll(/ style="[^"]*"| style='[^']*'/gi, "");

  return sanitize(preStripped, {
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
    KEEP_CONTENT: true,
  });
};

/**
 * Force every link in survey content to open in a new tab.
 * Links pasted as plain text are auto-linked without a target, so without this a
 * respondent following one navigates away from the survey they are filling in.
 * Kept on the render path so surveys authored before the editor fix behave too.
 * @param node - The node DOMPurify is currently sanitizing
 */
const openLinksInNewTab = (node: Element): void => {
  if (node.tagName !== "A" || !node.hasAttribute("href")) return;
  if (!node.getAttribute("target")) {
    node.setAttribute("target", "_blank");
  }
  if (node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

/**
 * Sanitize survey content HTML for rendering: strips inline styles (CSP) and makes
 * links open in a new tab.
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string, safe to pass to dangerouslySetInnerHTML
 */
export const sanitizeSurveyHtml = (html: string): string => {
  if (!html) return html;

  addHook("afterSanitizeAttributes", openLinksInNewTab);
  try {
    return sanitize(stripInlineStyles(html), {
      ADD_ATTR: ["target"],
      FORBID_ATTR: ["style"],
    });
  } finally {
    removeHook("afterSanitizeAttributes");
  }
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

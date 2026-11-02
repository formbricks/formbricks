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

// One opening tag. A quoted value is consumed whole, so a `>` inside it does not end the tag, and `<` is
// excluded outside quotes so a stray one ends the attempt instead of scanning to the end of the string.
// Every alternative starts with a different character, so there is no backtracking to speak of.
const OPENING_TAG = /<[a-zA-Z](?:"[^"]*"|'[^']*'|[^<>"'])*>/g;
// Inside a tag, one attribute: a name and an optional `= value`. The value is quoted or bare, and a quoted
// one is consumed whole, so text inside another attribute's value that looks like `style = 'x'`
// (`title="Choose style = 'casual'"`) is never mistaken for an attribute. Built from named parts so each
// stays readable.
// The separator in front of the name is ONE optional whitespace character, deliberately not `\s+`: a run of
// n spaces would be rescanned from every position (quadratic), and HTML does not need a separator after a
// closing quote (`title="x"style="y"`), where browsers still read `style` as an attribute. No lookbehind:
// an engine without it would throw while this module loads.
const ATTRIBUTE_NAME = String.raw`[^\s"'<>/=]+`;
const ATTRIBUTE_VALUE = String.raw`"[^"]*"|'[^']*'|[^\s"'>]*`;
const ATTRIBUTE = new RegExp(String.raw`\s?(${ATTRIBUTE_NAME})(?:\s*=\s*(?:${ATTRIBUTE_VALUE}))?`, "g");
// `<p`, the tag name, which is not an attribute (a `<style>` element is not a style attribute).
const TAG_NAME = /^<[^\s/>]+/;

/**
 * Removes `style` attributes from the opening tags of a raw HTML string, without parsing it.
 * Must run BEFORE anything parses the markup: under a strict CSP `style-src` the browser reports every
 * element it parses with a style attribute, even one discarded afterwards, so stripping the attribute
 * from the parsed tree is too late.
 * Any whitespace may separate the attribute from the tag (a newline or tab, not just a space), or nothing
 * at all after a closing quote or a `/`, and it may surround the `=`; the value may be quoted or not. Text
 * outside tags, and other attributes' values, are left alone.
 * @param html - The raw HTML string
 * @returns The string without its style attributes
 */
export const removeStyleAttributes = (html: string): string =>
  html.replaceAll(OPENING_TAG, (tag) => {
    const tagName = TAG_NAME.exec(tag)?.[0] ?? "";
    const attributes = tag
      .slice(tagName.length)
      .replaceAll(ATTRIBUTE, (attribute, name: string) => (name.toLowerCase() === "style" ? "" : attribute));
    return tagName + attributes;
  });

/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * Uses DOMPurify for secure, proper HTML parsing after the raw string is pre-stripped
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 */
export const stripInlineStyles = (html: string): string => {
  if (!html) return html;

  // DOMPurify parses with the browser's HTML parser, which triggers CSP `style-src` violations at
  // parse time, before FORBID_ATTR can strip anything, so the attributes go from the raw string first.
  const preStripped = removeStyleAttributes(html);

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

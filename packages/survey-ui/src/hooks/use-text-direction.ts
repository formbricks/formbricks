import { useMemo } from "react";

/**
 * Detects whether a string contains RTL (right-to-left) or LTR (left-to-right) characters
 * Returns 'rtl' if RTL characters are found, 'ltr' if LTR characters are found, 'neutral' if no directional characters
 *
 * @param text - The text to analyze
 * @returns 'rtl' | 'ltr' | 'neutral'
 *
 * @example
 * detectTextDirection("Hello world") // returns 'ltr'
 * detectTextDirection("مرحبا بالعالم") // returns 'rtl'
 * detectTextDirection("123 !@#") // returns 'neutral'
 */
function detectTextDirection(text: string): "rtl" | "ltr" | "neutral" {
  if (!text || text.trim().length === 0) {
    return "neutral";
  }

  // Unicode ranges for RTL characters:
  // Hebrew: \u0590-\u05FF
  // Arabic: \u0600-\u06FF
  // Arabic Supplement: \u0750-\u077F
  // Arabic Extended-A: \u0800-\u083F
  // Arabic Extended-B: \u0840-\u085F
  // Syriac: \u0700-\u074F
  // Thaana: \u0780-\u07BF
  // Nko: \u07C0-\u07FF
  const rtlPattern =
    /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u0800-\u083F\u0840-\u085F\u07C0-\u07FF]/g;

  // Unicode ranges for LTR characters:
  // Latin: \u0041-\u005A (A-Z), \u0061-\u007A (a-z)
  // Latin Extended: \u0100-\u017F
  // Latin Extended-A: \u0100-\u017F
  // Latin Extended-B: \u0180-\u024F
  const ltrPattern = /[A-Za-z\u0100-\u024F]/g;

  const rtlMatch = text.match(rtlPattern);
  const ltrMatch = text.match(ltrPattern);

  // If both RTL and LTR characters are present, RTL takes precedence
  if (rtlMatch && ltrMatch) {
    return rtlMatch.length >= ltrMatch.length ? "rtl" : "ltr";
  }

  if (rtlMatch) {
    return "rtl";
  }

  if (ltrMatch) {
    return "ltr";
  }

  return "neutral";
}

export interface UseTextDirectionOptions {
  /** Explicit direction prop (takes precedence over detection) */
  dir?: "ltr" | "rtl" | "auto";
  /** Text content to analyze for direction detection */
  textContent?: string | string[];
}

/**
 * Hook to detect and determine text direction for form elements
 *
 * @param options - Configuration options
 * @param options.dir - Explicit direction prop (if provided, takes precedence)
 * @param options.textContent - Text content(s) to analyze for automatic detection
 * @returns The detected or provided text direction ("ltr" | "rtl" | undefined)
 *
 * @example
 * ```tsx
 * const dir = useTextDirection({
 *   dir: "auto",
 *   textContent: [headline, description, placeholder]
 * });
 * ```
 */
export function useTextDirection({ dir, textContent }: UseTextDirectionOptions): "ltr" | "rtl" | undefined {
  return useMemo(() => {
    // If explicit direction is provided and not "auto", use it
    if (dir && dir !== "auto") {
      return dir;
    }

    // If no text content provided, return undefined
    if (!textContent) {
      return undefined;
    }

    // Handle array of strings or single string
    const textsToCheck = Array.isArray(textContent) ? textContent : [textContent];

    // Find the first non-empty text
    const textToCheck = textsToCheck.find((text) => text && text.trim().length > 0) || "";

    // Detect direction from text
    const detected = detectTextDirection(textToCheck);

    // Convert "neutral" to undefined (browsers handle neutral as auto)
    return detected === "neutral" ? undefined : detected;
  }, [dir, textContent]);
}

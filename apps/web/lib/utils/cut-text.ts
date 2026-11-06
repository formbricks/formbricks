const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * `text` cut to at most `max` UTF-16 units, the length JavaScript and most limits count, ending in
 * `suffix` when it was cut. Never splits a surrogate pair: an emoji at the cut is dropped whole rather
 * than left as a lone half, which shows as a replacement character and is not valid XML.
 */
export const cutText = (text: string, max: number, suffix = ""): string => {
  if (text.length <= max) return text;
  let end = max - suffix.length;
  // The UTF-16 unit, not the code point: a lone high surrogate is what must not end the text.
  if (isHighSurrogate(text.charCodeAt(end - 1))) end -= 1; // NOSONAR(typescript:S7758) -- a unit, on purpose
  return `${text.slice(0, end)}${suffix}`;
};

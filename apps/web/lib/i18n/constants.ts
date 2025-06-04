export const INVISIBLE_CHARACTERS = ["\u200C", "\u200D"];
export const INVISIBLE_REGEX = RegExp(`([${INVISIBLE_CHARACTERS.join("")}]{9})+`, "gu");

import {
  MEMBER_ATTRIBUTE_KEY_PATTERN,
  MEMBER_ATTRIBUTE_MAX_KEY_LENGTH,
  MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY,
  MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH,
  MEMBER_ATTRIBUTE_RESERVED_KEYS,
} from "./limits";

/**
 * How a value is matched: `lower(trim(value))`, the same expression the `normalizedValue` column stores
 * and Dashboard Viewer access compares (GLOSSARY: "Matching ignores case and surrounding spaces").
 */
export const normalizeMemberAttributeValue = (value: string): string => value.trim().toLowerCase();

export type TMemberAttributeValuesProblem =
  | { code: "too_many_values"; limit: number }
  | { code: "value_too_long"; limit: number; value: string }
  | { code: "invalid_character"; value: string };

export type TPreparedMemberAttributeValues =
  | { ok: true; values: string[] }
  | { ok: false; problem: TMemberAttributeValuesProblem };

/**
 * The values one member holds for one key, as they will be stored: trimmed, empty ones dropped, and a
 * value that differs from an earlier one only by case or surrounding spaces dropped too (the first
 * spelling wins). Refuses a list past the per-key cap, a value past the length cap and a NUL, which
 * Postgres refuses with a 500. The caps are checked on the deduplicated list, so "Sweden, sweden" is one.
 */
export const prepareMemberAttributeValues = (values: readonly string[]): TPreparedMemberAttributeValues => {
  const seen = new Set<string>();
  const prepared: string[] = [];

  for (const raw of values) {
    const value = raw.trim();
    if (value === "") continue;
    if (value.includes("\u0000")) return { ok: false, problem: { code: "invalid_character", value } };
    if (value.length > MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH) {
      return {
        ok: false,
        problem: { code: "value_too_long", limit: MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH, value },
      };
    }
    const normalized = normalizeMemberAttributeValue(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    prepared.push(value);
  }

  if (prepared.length > MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY) {
    return { ok: false, problem: { code: "too_many_values", limit: MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY } };
  }

  return { ok: true, values: prepared };
};

export type TMemberAttributeKeyProblem = "empty" | "too_long" | "invalid_format" | "reserved";

/** Why `key` cannot name a Member attribute, or `null` when it can. */
export const getMemberAttributeKeyProblem = (key: string): TMemberAttributeKeyProblem | null => {
  if (key.length === 0) return "empty";
  if (key.length > MEMBER_ATTRIBUTE_MAX_KEY_LENGTH) return "too_long";
  if (!MEMBER_ATTRIBUTE_KEY_PATTERN.test(key)) return "invalid_format";
  if (MEMBER_ATTRIBUTE_RESERVED_KEYS.has(key)) return "reserved";
  return null;
};

/** Strips underscores from the end of `value`, and from its start too when `leading`; a loop, not a backtracking regex. */
const trimUnderscores = (value: string, leading: boolean): string => {
  let start = 0;
  let end = value.length;
  if (leading) {
    while (start < end && value[start] === "_") start++;
  }
  while (end > start && value[end - 1] === "_") end--;
  return value.slice(start, end);
};

/**
 * The key the Create attribute dialog suggests for a label until the person edits the key: "Sales
 * region" → `sales_region`, "Größe" → `grosse`. Accents are folded, anything else that is not a letter or
 * a digit becomes one underscore, and a leading digit gets a letter in front, so the suggestion is always
 * a valid key unless the label has no letters or digits at all (then it is "").
 */
export const suggestMemberAttributeKey = (label: string): string => {
  const folded = label.normalize("NFKD").replace(/\p{M}/gu, "").replaceAll("ß", "ss").toLowerCase();
  const key = trimUnderscores(folded.replace(/[^a-z0-9]+/g, "_"), true).slice(
    0,
    MEMBER_ATTRIBUTE_MAX_KEY_LENGTH
  );
  if (key === "") return "";
  const withLetter = /^\d/.test(key) ? `a_${key}` : key;
  return trimUnderscores(withLetter.slice(0, MEMBER_ATTRIBUTE_MAX_KEY_LENGTH), false);
};

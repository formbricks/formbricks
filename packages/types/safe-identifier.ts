/**
 * The pre-existing declared-id character rule: alphanumeric, underscores and hyphens, with no
 * leading-letter requirement. Kept only so already-stored surveys keep loading; new names must
 * satisfy `isSafeIdentifier` instead.
 */
const LEGACY_ID_CHARSET_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * The pre-existing variable name rule. Note it lacks the leading-letter requirement, so it
 * accepts names such as `_foo` and `1foo` that `isSafeIdentifier` rejects. That difference is
 * intentional: surveys already store such names and must keep loading.
 */
const LEGACY_VARIABLE_NAME_REGEX = /^[a-z0-9_]+$/;

/**
 * Validates that a string is a safe identifier.
 * Safe identifiers can only contain lowercase letters, numbers, and underscores.
 * They cannot start with a number.
 */
export const isSafeIdentifier = (value: string): boolean => {
  // Must start with a lowercase letter
  if (!/^[a-z]/.test(value)) {
    return false;
  }
  // Can only contain lowercase letters, numbers, and underscores
  return /^[a-z0-9_]+$/.test(value);
};

/**
 * Converts a free-form string to a safe identifier candidate.
 * The output only contains lowercase letters, numbers, and underscores.
 * It also ensures the identifier starts with a lowercase letter by stripping invalid leading chars.
 */
export const toSafeIdentifier = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  let safeIdentifier = "";
  let shouldInsertUnderscore = false;

  for (const char of normalized) {
    const isLowercaseLetter = char >= "a" && char <= "z";
    const isDigit = char >= "0" && char <= "9";

    if (isLowercaseLetter || isDigit) {
      if (shouldInsertUnderscore && safeIdentifier.length > 0) {
        safeIdentifier += "_";
      }
      safeIdentifier += char;
      shouldInsertUnderscore = false;
      continue;
    }

    if (safeIdentifier.length > 0) {
      shouldInsertUnderscore = true;
    }
  }

  for (let i = 0; i < safeIdentifier.length; i++) {
    const char = safeIdentifier[i];
    if (char >= "a" && char <= "z") {
      return safeIdentifier.slice(i);
    }
  }

  return "";
};

/**
 * Converts a snake_case string to Title Case for display as a label.
 * Example: "job_description" -> "Job Description"
 *          "api_key" -> "Api Key"
 *          "signup_date" -> "Signup Date"
 *
 * Empty segments are dropped, because `isSafeIdentifier` allows leading, trailing and repeated
 * underscores: without the filter a key like `a__b` would render with a double space.
 */
export const formatSnakeCaseToTitleCase = (key: string): string => {
  return key
    .split("_")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Legacy shim for the load path: the character rule every declared id was stored under before
 * `isSafeIdentifier` existed. Via `validateId` this governs element and question ids as well as
 * hidden field ids, hence the charset-level name. Survey schemas validate already-persisted names
 * with this, so tightening it would stop existing surveys from loading — and element/question ids
 * never graduate to the strict rule, because `Q1` has to stay a legal question id. Editors gate
 * new *declared field* names with `isSafeIdentifier` on top of this.
 */
export const isLegacyIdCharset = (value: string): boolean => LEGACY_ID_CHARSET_REGEX.test(value);

/**
 * Legacy shim for the load path: the character rule survey variables were stored under before
 * `isSafeIdentifier` existed. Deliberately more permissive than `isSafeIdentifier` (no
 * leading-letter requirement) so surveys holding names like `_legacy` keep loading.
 */
export const isLegacyVariableName = (value: string): boolean => LEGACY_VARIABLE_NAME_REGEX.test(value);

/**
 * Matches `target` against `candidates`, tolerating case drift between a declared field name and the
 * name it arrives under (URL param, CSV header, API payload key).
 *
 * Returns the matching entry from `candidates`, never `target`, so the caller can normalise onto
 * whichever side it treats as canonical. The direction is the caller's choice: pass the declared
 * names as `candidates` to resolve an incoming name onto its declared spelling, or pass the incoming
 * names as `candidates` to find which one a declared field should read from.
 *
 * Precedence: an exact match always beats a case-insensitive one. When several candidates differ
 * only by case, the earliest in `candidates` order wins, so the result never depends on the order
 * the other side happens to arrive in.
 */
export const matchDeclaredFieldName = (candidates: string[], target: string): string | undefined => {
  const exactMatch = candidates.find((candidate) => candidate === target);
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  const lowercasedTarget = target.toLowerCase();
  return candidates.find((candidate) => candidate.toLowerCase() === lowercasedTarget);
};

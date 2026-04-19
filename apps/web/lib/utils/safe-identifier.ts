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
 */
export const formatSnakeCaseToTitleCase = (key: string): string => {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

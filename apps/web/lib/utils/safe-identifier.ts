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

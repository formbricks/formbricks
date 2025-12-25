/**
 * Validates that a string is a safe identifier.
 * Safe identifiers can only contain lowercase letters, numbers, and underscores.
 * They cannot start with a number.
 *
 * This matches the validation used for survey variable names (see formbricks#5342).
 */
export const isSafeIdentifier = (value: string): boolean => {
  // Must start with a lowercase letter
  if (!/^[a-z]/.test(value)) {
    return false;
  }
  // Can only contain lowercase letters, numbers, and underscores
  return /^[a-z0-9_]+$/.test(value);
};

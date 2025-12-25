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

/**
 * Converts a string to a safe identifier by:
 * - Converting to lowercase
 * - Replacing invalid characters with underscores
 * - Removing leading/trailing underscores
 * - Ensuring it starts with a letter (prepending 'attr_' if it starts with a number)
 */
export const toSafeIdentifier = (value: string): string => {
  if (!value) return "";

  // Convert to lowercase and replace invalid characters with underscores
  let safe = value
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "") // Remove accents
    .replaceAll(/[^a-z\d_]/g, "_") // Replace invalid chars with underscore
    .replaceAll(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+/, "") // Remove leading underscores
    .replace(/_+$/, ""); // Remove trailing underscores

  // If it starts with a number, prepend 'attr_'
  if (/^\d/.test(safe)) {
    safe = `attr_${safe}`;
  }

  // If empty after sanitization, return a default
  if (!safe) {
    safe = "attr_key";
  }

  return safe;
};

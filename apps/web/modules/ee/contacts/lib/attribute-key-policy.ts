// Keep these keys reserved until the v5.1 migration moves default contact attributes
// from camelCase to safe identifiers with backward compatibility aliases.
// This is a preventive guardrail only (no schema/data migration in v5).
export const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEYS = [
  "user_id",
  "first_name",
  "last_name",
] as const;

export const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEYS_TEXT =
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEYS.join(", ");

export const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE = `Key is reserved for the v5.1 safe-identifier default attribute migration. Reserved keys: ${RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEYS_TEXT}.`;

const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEY_SET: ReadonlySet<string> = new Set(
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEYS
);

const normalizeKey = (key: string): string => key.trim().toLowerCase();

export const isReservedFutureDefaultAttributeKey = (key: string): boolean => {
  return RESERVED_FUTURE_DEFAULT_ATTRIBUTE_SAFE_IDENTIFIER_KEY_SET.has(normalizeKey(key));
};

export const getReservedFutureDefaultAttributeKeys = (keys: string[]): string[] => {
  const normalized = keys
    .map(normalizeKey)
    .filter((key) => key.length > 0 && isReservedFutureDefaultAttributeKey(key));

  return Array.from(new Set(normalized));
};

export const getReservedFutureDefaultAttributeKeyIssue = (keys: string[]): string => {
  const reservedKeys = getReservedFutureDefaultAttributeKeys(keys);

  return `Reserved attribute key(s): ${reservedKeys.join(
    ", "
  )}. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes.`;
};

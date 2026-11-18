/**
 * Structured message with code and params for i18n support.
 * Used for both UI-facing messages (translated) and API/SDK responses (formatted to English).
 */
export interface TAttributeUpdateMessage {
  code: string;
  params: Record<string, string>;
}

/**
 * English templates for formatting structured messages to human-readable strings.
 * Used by SDK/API paths that return English responses.
 */
const MESSAGE_TEMPLATES: Record<string, string> = {
  email_or_userid_required: "Either email or userId is required. The existing values were preserved.",
  attribute_type_validation_error: "{error} (attribute '{key}' has dataType: {dataType})",
  email_already_exists: "The email already exists for this workspace and was not updated.",
  userid_already_exists: "The userId already exists for this workspace and was not updated.",
  invalid_attribute_keys:
    "Skipped creating attribute(s) with invalid key(s): {keys}. Keys must only contain lowercase letters, numbers, and underscores, and must start with a letter.",
  reserved_attribute_keys: "{issue}",
  attribute_limit_exceeded:
    "Could not create {count} new attribute(s) as it would exceed the maximum limit of {limit} attribute classes. Existing attributes were updated successfully.",
  new_attribute_created: "Created new attribute '{key}' with type '{dataType}'",
  invalid_language_ignored: "Ignored invalid language code '{language}'. The existing value was preserved.",
};

/**
 * Formats a structured message to a human-readable English string.
 * Used for API/SDK responses.
 */
export const formatAttributeMessage = (msg: TAttributeUpdateMessage): string => {
  let template = MESSAGE_TEMPLATES[msg.code] || msg.code;
  for (const [key, value] of Object.entries(msg.params)) {
    template = template.replaceAll(`{${key}}`, value);
  }
  return template;
};

/**
 * The rules for a workspace's names for its imported (embedded-data) keys: the caps, how a typed name is
 * normalised, and which name a field is shown under. Client-safe and shared by the route that writes the
 * names and the chart builder that shows and edits them, so both apply the same rules.
 */

/** Most characters a key's display name may have. */
export const MAX_EMBEDDED_FIELD_LABEL_LENGTH = 100;

/**
 * Most renamed keys one workspace may hold. Far above the keys a workspace's datasets compile
 * (`MAX_TOKEN_EMBEDDED_KEYS` per dataset), so it only stops a script from filling the table.
 */
export const MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE = 1000;

// Control characters (NUL included, which Postgres refuses in text) never belong in a display name.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** Whether a display name may be stored: no control characters. Length is checked on its own. */
export const isStorableEmbeddedFieldLabel = (label: string): boolean => !CONTROL_CHARACTER.test(label);

/**
 * The name to store for a key, from what the person typed: trimmed, and `null` — no override, the key
 * shows as collected — when it is empty or the key itself.
 */
export const normalizeEmbeddedFieldLabel = (key: string, label: string): string | null => {
  const trimmed = label.trim();
  return trimmed.length === 0 || trimmed === key ? null : trimmed;
};

/** What an embedded-data field is shown as: its workspace name, else its key as collected. */
export const getEmbeddedFieldDisplayName = (field: { key: string; label?: string }): string =>
  field.label ?? field.key;

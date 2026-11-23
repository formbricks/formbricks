/**
 * Strips OAuth credentials out of an integration before it is handed to a client component.
 *
 * The integration settings pages pass the whole integration — including `config.key`, which holds the
 * provider's `access_token` and, for Google Sheets and Airtable, a long-lived `refresh_token` — into
 * `"use client"` wrappers. Anything a client component receives is serialized into the RSC payload and
 * readable in the page source, so those credentials were exposed to every member who could open the
 * page, and to anything with access to that HTML (browser extensions, HAR captures, a shared screen).
 * A refresh token in particular grants access to the connected Google/Airtable account well outside
 * Formbricks, and long after the member's Formbricks access is revoked.
 *
 * The client only needs the non-secret parts: `config.data` (the survey→destination mappings),
 * `config.email`, and a few display/presence fields inside `key` (`bot_id`, `workspace_name`,
 * `team.name`). Secret fields are blanked rather than removed so every consumer stays type-valid.
 */
const REDACTED = "";

/**
 * Matched against each field name in `config.key`, so a credential a provider adds later is redacted by
 * default rather than exposed until someone remembers to extend a list.
 *
 * Deliberately matches `token` only as a whole word or `*_token` suffix: Slack and Google Sheets type
 * `token_type` as a Zod *literal* (`"bot"` / `"Bearer"`), so blanking it would make the redacted object
 * fail to satisfy the integration type it is passed as. `token_type` names a scheme, not a secret.
 */
const SECRET_KEY_FIELD_PATTERN = /(^token$|_token$|secret|password|credential|private_key|api_?key)/i;

/** Always redacted, whatever the pattern says. */
const SECRET_KEY_FIELDS = ["access_token", "refresh_token"] as const;

const isSecretKeyField = (field: string): boolean =>
  SECRET_KEY_FIELDS.includes(field as (typeof SECRET_KEY_FIELDS)[number]) ||
  SECRET_KEY_FIELD_PATTERN.test(field);

type TIntegrationWithConfig = {
  config?: { key?: Record<string, unknown> | null } | null;
};

export const redactIntegrationCredentials = <T extends TIntegrationWithConfig>(
  integration: T | undefined
): T | undefined => {
  if (!integration?.config?.key || typeof integration.config.key !== "object") {
    return integration;
  }

  const redactedKey: Record<string, unknown> = { ...integration.config.key };
  for (const field of Object.keys(redactedKey)) {
    // Only string values are blanked: every credential these providers issue is a string, and an
    // object- or number-typed field (Slack's `team`, Google's `expiry_date`) would stop matching its
    // schema if replaced with "".
    if (isSecretKeyField(field) && typeof redactedKey[field] === "string") {
      redactedKey[field] = REDACTED;
    }
  }

  return {
    ...integration,
    config: { ...integration.config, key: redactedKey },
  };
};

/**
 * The inbound counterpart to {@link redactIntegrationCredentials}: replaces a client-supplied
 * `config.key` with the stored one.
 *
 * Because the settings pages redact credentials on the way out, and the mapping UI echoes the whole
 * integration object back when a link is added, edited or removed, an unguarded save writes the blanked
 * tokens over the real ones — disconnecting the integration while the UI still shows it as connected,
 * since the wrappers only test `config.key` for presence. Credentials therefore never come from the
 * request on that path; they are written only by the OAuth callbacks, which reach
 * `createOrUpdateIntegration` directly.
 *
 * With no stored integration there is nothing to preserve and the input passes through unchanged: that
 * is the first-connect case, which only the callbacks perform.
 */
export const withStoredIntegrationKey = <T extends TIntegrationWithConfig>(
  incoming: T,
  stored: TIntegrationWithConfig | null | undefined
): T => {
  if (!stored?.config?.key || !incoming.config) {
    return incoming;
  }

  return {
    ...incoming,
    config: { ...incoming.config, key: stored.config.key },
  };
};
